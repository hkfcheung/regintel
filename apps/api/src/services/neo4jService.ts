import neo4j, { Driver, Session, QueryResult } from "neo4j-driver";
import type { GraphEnvironment } from "@regintel/database";

/**
 * Neo4j Connection Service
 *
 * Manages connections to Neo4j graph database for both staging and production environments.
 * Handles connection pooling, health checks, and query execution.
 *
 * Environment Configuration:
 * - STAGING: Uses label prefix `_stg_` for all nodes (e.g., _stg_Drug, _stg_Trial)
 * - PRODUCTION: Uses standard labels (e.g., Drug, Trial)
 */

interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  database: string;
}

class Neo4jConnectionService {
  private driver: Driver | null = null;
  private config: Neo4jConfig;

  constructor() {
    this.config = {
      uri: process.env.NEO4J_URI || "bolt://localhost:7687",
      username: process.env.NEO4J_USERNAME || "neo4j",
      password: process.env.NEO4J_PASSWORD || "regintel123",
      database: process.env.NEO4J_DATABASE || "regintel",
    };
  }

  /**
   * Initialize the Neo4j driver connection
   */
  private async connect(): Promise<Driver> {
    if (this.driver) {
      return this.driver;
    }

    this.driver = neo4j.driver(
      this.config.uri,
      neo4j.auth.basic(this.config.username, this.config.password),
      {
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 60000, // 60 seconds
        maxTransactionRetryTime: 30000, // 30 seconds
      }
    );

    // Verify connectivity
    await this.driver.verifyConnectivity();
    console.log("✅ Neo4j driver connected successfully");

    return this.driver;
  }

  /**
   * Execute a Cypher query
   *
   * @param query - Cypher query string
   * @param params - Query parameters
   * @param environment - Target environment (STAGING or PRODUCTION)
   * @returns Query result
   */
  async executeCypher(
    query: string,
    params: Record<string, any> = {},
    environment: GraphEnvironment = "STAGING"
  ): Promise<QueryResult> {
    const driver = await this.connect();
    const session: Session = driver.session({
      database: this.config.database,
      defaultAccessMode: neo4j.session.WRITE,
    });

    try {
      // If staging environment, inject label prefix into the query
      let modifiedQuery = query;
      if (environment === "STAGING") {
        // This is a simple implementation - you may need more sophisticated label replacement
        modifiedQuery = this.addStagingPrefix(query);
      }

      const result = await session.run(modifiedQuery, params);
      return result;
    } finally {
      await session.close();
    }
  }

  /**
   * Execute a read-only Cypher query (for QA and validation)
   *
   * @param query - Cypher query string
   * @param params - Query parameters
   * @param environment - Target environment
   * @returns Query result
   */
  async executeReadQuery(
    query: string,
    params: Record<string, any> = {},
    environment: GraphEnvironment = "STAGING"
  ): Promise<QueryResult> {
    const driver = await this.connect();
    const session: Session = driver.session({
      database: this.config.database,
      defaultAccessMode: neo4j.session.READ,
    });

    try {
      let modifiedQuery = query;
      if (environment === "STAGING") {
        modifiedQuery = this.addStagingPrefix(query);
      }

      const result = await session.run(modifiedQuery, params);
      return result;
    } finally {
      await session.close();
    }
  }

  /**
   * Execute a single write query (CREATE, MERGE, DELETE, etc.)
   *
   * @param query - Cypher query to execute
   * @param params - Query parameters
   * @param environment - Target environment (STAGING or PRODUCTION)
   * @returns Query result
   */
  async executeWriteQuery(
    query: string,
    params: Record<string, any> = {},
    environment: GraphEnvironment = "STAGING"
  ): Promise<QueryResult> {
    const driver = await this.connect();
    const session: Session = driver.session({
      database: this.config.database,
      defaultAccessMode: neo4j.session.WRITE,
    });

    try {
      // Note: Staging prefix is already in the query from backfill service
      // No need to modify here
      const result = await session.run(query, params);
      return result;
    } finally {
      await session.close();
    }
  }

  /**
   * Execute multiple Cypher queries in a transaction
   *
   * @param queries - Array of {query, params} objects
   * @param environment - Target environment
   * @returns Array of results
   */
  async executeTransaction(
    queries: Array<{ query: string; params: Record<string, any> }>,
    environment: GraphEnvironment = "STAGING"
  ): Promise<QueryResult[]> {
    const driver = await this.connect();
    const session: Session = driver.session({
      database: this.config.database,
    });

    try {
      return await session.executeWrite(async (tx) => {
        const results: QueryResult[] = [];
        for (const { query, params } of queries) {
          let modifiedQuery = query;
          if (environment === "STAGING") {
            modifiedQuery = this.addStagingPrefix(query);
          }
          const result = await tx.run(modifiedQuery, params);
          results.push(result);
        }
        return results;
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Check if Neo4j is healthy and responsive
   *
   * @returns true if healthy, false otherwise
   */
  async checkHealth(): Promise<boolean> {
    try {
      const driver = await this.connect();
      await driver.verifyConnectivity();

      // Run a simple query to verify the database is responsive
      const result = await this.executeReadQuery("RETURN 1 as health", {}, "PRODUCTION");
      return result.records.length > 0;
    } catch (error) {
      console.error("Neo4j health check failed:", error);
      return false;
    }
  }

  /**
   * Get database statistics
   *
   * @param environment - Target environment
   * @returns Database statistics
   */
  async getStatistics(environment: GraphEnvironment = "STAGING"): Promise<{
    nodeCount: number;
    relationshipCount: number;
    labelCounts: Record<string, number>;
  }> {
    const nodeCountQuery = "MATCH (n) RETURN count(n) as count";
    const relCountQuery = "MATCH ()-[r]->() RETURN count(r) as count";
    const labelCountsQuery = "CALL db.labels() YIELD label CALL { WITH label MATCH (n) WHERE label IN labels(n) RETURN count(n) as count } RETURN label, count";

    const nodeResult = await this.executeReadQuery(nodeCountQuery, {}, environment);
    const relResult = await this.executeReadQuery(relCountQuery, {}, environment);
    const labelResult = await this.executeReadQuery(labelCountsQuery, {}, environment);

    const nodeCount = nodeResult.records[0]?.get("count")?.toNumber() || 0;
    const relationshipCount = relResult.records[0]?.get("count")?.toNumber() || 0;

    const labelCounts: Record<string, number> = {};
    for (const record of labelResult.records) {
      const label = record.get("label");
      const count = record.get("count")?.toNumber() || 0;
      labelCounts[label] = count;
    }

    return {
      nodeCount,
      relationshipCount,
      labelCounts,
    };
  }

  /**
   * Add staging label prefix to a Cypher query
   *
   * This is a simplified implementation. For production, consider using
   * a proper Cypher parser to handle complex queries.
   *
   * @param query - Original Cypher query
   * @returns Modified query with staging prefixes
   */
  private addStagingPrefix(query: string): string {
    // Simple regex-based replacement for common label patterns
    // This replaces patterns like `:Drug` with `:_stg_Drug`
    // but avoids double-prefixing if already prefixed

    return query.replace(
      /:([A-Z][a-zA-Z0-9]*)/g,
      (match, label) => {
        if (label.startsWith("_stg_")) {
          return match; // Already prefixed
        }
        return `:_stg_${label}`;
      }
    );
  }

  /**
   * Close all connections and clean up resources
   */
  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      console.log("✅ Neo4j driver closed");
    }
  }

  /**
   * Run QA validation queries to ensure data integrity
   *
   * CRITICAL: Query #0 verifies ONLY APPROVED data exists in Neo4j
   *
   * @param environment - Target environment
   * @returns Validation results
   */
  async runQAValidation(environment: GraphEnvironment = "STAGING"): Promise<{
    query0_nonApprovedCount: number;
    query1_orphanRelationships: number;
    query3_duplicateKeys: Array<{ key: string; count: number }>;
    query7_missingApprovalMetadata: number;
    passed: boolean;
  }> {
    // Query #0: CRITICAL - Verify ONLY approved data in Neo4j
    const query0 = `
      MATCH (n)
      WHERE n.approvalStatus IS NOT NULL
        AND n.approvalStatus <> 'APPROVED'
      RETURN count(*) as nonApprovedCount
    `;

    // Query #1: Find orphan relationships (simplified check)
    const query1 = `
      MATCH (n)-[r]->(m)
      WHERE m IS NULL
      RETURN count(r) as orphanCount
    `;

    // Query #3: Detect duplicate keys (example for Drug nodes)
    const query3 = `
      MATCH (n:Drug)
      WITH n.drugId as key, collect(n) as nodes
      WHERE size(nodes) > 1
      RETURN key, size(nodes) as duplicateCount
    `;

    // Query #7: Verify all nodes have approval metadata
    const query7 = `
      MATCH (n)
      WHERE n.approvalStatus IS NULL
         OR n.approvedBy IS NULL
         OR n.approvedAt IS NULL
      RETURN count(*) as missingApprovalMetadata
    `;

    try {
      const result0 = await this.executeReadQuery(query0, {}, environment);
      const result1 = await this.executeReadQuery(query1, {}, environment);
      const result3 = await this.executeReadQuery(query3, {}, environment);
      const result7 = await this.executeReadQuery(query7, {}, environment);

      const nonApprovedCount = result0.records[0]?.get("nonApprovedCount")?.toNumber() || 0;
      const orphanCount = result1.records[0]?.get("orphanCount")?.toNumber() || 0;
      const missingApprovalMetadata = result7.records[0]?.get("missingApprovalMetadata")?.toNumber() || 0;

      const duplicateKeys = result3.records.map(record => ({
        key: record.get("key"),
        count: record.get("duplicateCount")?.toNumber() || 0,
      }));

      // Validation passes if:
      // - Query #0 returns 0 (no non-approved data)
      // - Query #7 returns 0 (all nodes have approval metadata)
      // - No orphan relationships
      const passed = nonApprovedCount === 0 && missingApprovalMetadata === 0 && orphanCount === 0;

      return {
        query0_nonApprovedCount: nonApprovedCount,
        query1_orphanRelationships: orphanCount,
        query3_duplicateKeys: duplicateKeys,
        query7_missingApprovalMetadata: missingApprovalMetadata,
        passed,
      };
    } catch (error) {
      console.error("QA validation failed:", error);
      throw error;
    }
  }
}

// Singleton instance
export const neo4jService = new Neo4jConnectionService();

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing Neo4j connection...");
  await neo4jService.close();
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, closing Neo4j connection...");
  await neo4jService.close();
});
