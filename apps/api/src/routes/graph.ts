import { FastifyPluginAsync } from "fastify";
import neo4j from "neo4j-driver";
import { neo4jService } from "../services/neo4jService.js";
import {
  generateGraphProposal,
  saveGraphProposal,
  type ProposalInput,
} from "../services/graphProposalService.js";
import {
  generateCypherTemplates,
  saveCypherTemplates,
  validateTemplate,
} from "../services/cypherTemplateService.js";
import { graphBackfillService } from "../services/graphBackfillService.js";
import { prisma } from "@regintel/database";
import type { GraphEnvironment } from "@regintel/database";

/**
 * Graph Configuration API Routes
 *
 * Provides endpoints for managing Neo4j graph configurations, including:
 * - Health checks
 * - Statistics
 * - QA validation
 * - Proposal generation (AI-powered)
 * - Configuration management
 */

export const graphRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /graph/health
   * Check Neo4j connection health
   */
  fastify.get("/health", async (request, reply) => {
    try {
      const isHealthy = await neo4jService.checkHealth();

      if (isHealthy) {
        return {
          status: "healthy",
          message: "Neo4j is connected and responsive",
          timestamp: new Date().toISOString(),
        };
      } else {
        reply.code(503);
        return {
          status: "unhealthy",
          message: "Neo4j is not responding",
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      fastify.log.error("Neo4j health check failed:", error);
      reply.code(503);
      return {
        status: "unhealthy",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  });

  /**
   * GET /graph/stats
   * Get database statistics for staging or production
   *
   * Query parameters:
   * - environment: "STAGING" or "PRODUCTION" (default: STAGING)
   */
  fastify.get<{
    Querystring: { environment?: GraphEnvironment };
  }>(
    "/stats",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            environment: {
              type: "string",
              enum: ["STAGING", "PRODUCTION"],
              default: "STAGING",
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { environment = "STAGING" } = request.query;
        const stats = await neo4jService.getStatistics(environment);

        return {
          environment,
          ...stats,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        fastify.log.error("Failed to get Neo4j statistics:", error);
        reply.code(500);
        return {
          error: "Failed to retrieve statistics",
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  /**
   * GET /graph/qa
   * Run QA validation queries to ensure data integrity
   *
   * Query parameters:
   * - environment: "STAGING" or "PRODUCTION" (default: STAGING)
   *
   * CRITICAL: Query #0 verifies ONLY APPROVED data exists in Neo4j
   */
  fastify.get<{
    Querystring: { environment?: GraphEnvironment };
  }>(
    "/qa",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            environment: {
              type: "string",
              enum: ["STAGING", "PRODUCTION"],
              default: "STAGING",
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { environment = "STAGING" } = request.query;
        const validation = await neo4jService.runQAValidation(environment);

        return {
          environment,
          validation,
          passed: validation.passed,
          timestamp: new Date().toISOString(),
          criticalChecks: {
            approvedDataOnly: validation.query0_nonApprovedCount === 0
              ? "✅ PASSED - All data is APPROVED"
              : `❌ FAILED - Found ${validation.query0_nonApprovedCount} non-approved records`,
            approvalMetadata: validation.query7_missingApprovalMetadata === 0
              ? "✅ PASSED - All nodes have approval metadata"
              : `❌ FAILED - ${validation.query7_missingApprovalMetadata} nodes missing approval metadata`,
          },
        };
      } catch (error) {
        fastify.log.error("QA validation failed:", error);
        reply.code(500);
        return {
          error: "QA validation failed",
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  /**
   * POST /graph/query
   * Execute a custom Cypher query (read-only)
   *
   * Body:
   * - query: Cypher query string
   * - params: Query parameters (optional)
   * - environment: "STAGING" or "PRODUCTION" (default: STAGING)
   *
   * NOTE: This endpoint is for development/testing only
   * TODO: Add authentication and authorization
   */
  fastify.post<{
    Body: {
      query: string;
      params?: Record<string, any>;
      environment?: GraphEnvironment;
    };
  }>(
    "/query",
    {
      schema: {
        body: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string" },
            params: { type: "object" },
            environment: {
              type: "string",
              enum: ["STAGING", "PRODUCTION"],
              default: "STAGING",
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { query, params = {}, environment = "STAGING" } = request.body;

        // Basic security: only allow read queries
        const queryLower = query.toLowerCase().trim();
        const writeKeywords = ["create", "merge", "delete", "remove", "set", "detach"];
        const hasWriteOperation = writeKeywords.some((keyword) =>
          queryLower.includes(keyword)
        );

        if (hasWriteOperation) {
          reply.code(403);
          return {
            error: "Write operations are not allowed via this endpoint",
            message: "Use dedicated API endpoints for write operations",
          };
        }

        const result = await neo4jService.executeReadQuery(query, params, environment);

        // Convert Neo4j records to plain objects
        const records = result.records.map((record) => {
          const obj: Record<string, any> = {};
          record.keys.forEach((key) => {
            const value = record.get(key);
            // Convert Neo4j integers to JavaScript numbers
            obj[key] = typeof value === "object" && value?.toNumber
              ? value.toNumber()
              : value;
          });
          return obj;
        });

        return {
          environment,
          recordCount: records.length,
          records,
          summary: {
            query: result.summary.query.text,
            parameters: result.summary.query.parameters,
            resultAvailableAfter: result.summary.resultAvailableAfter.toNumber(),
            resultConsumedAfter: result.summary.resultConsumedAfter.toNumber(),
          },
        };
      } catch (error) {
        fastify.log.error("Query execution failed:", error);
        reply.code(500);
        return {
          error: "Query execution failed",
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  /**
   * POST /graph/propose
   * Generate an AI-powered graph model proposal
   *
   * Body:
   * - profile: Industry/company/focus description
   * - goals: Array of analytical goals
   * - context: Optional additional context
   * - trustedSources: Optional list of trusted source domains
   */
  fastify.post<{
    Body: ProposalInput;
  }>(
    "/propose",
    {
      schema: {
        body: {
          type: "object",
          required: ["profile", "goals"],
          properties: {
            profile: { type: "string" },
            goals: { type: "array", items: { type: "string" } },
            context: { type: "string" },
            trustedSources: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const input = request.body;

        // Validate input
        if (!input.profile || input.profile.trim().length === 0) {
          reply.code(400);
          return {
            error: "Profile is required",
            message: "Please provide a description of your industry/company/focus",
          };
        }

        if (!input.goals || input.goals.length === 0) {
          reply.code(400);
          return {
            error: "Goals are required",
            message: "Please provide at least one analytical goal",
          };
        }

        // Generate proposal using AI
        const proposal = await generateGraphProposal(input);

        return {
          success: true,
          proposal,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        fastify.log.error("Proposal generation failed:", error);
        reply.code(500);
        return {
          error: "Proposal generation failed",
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  /**
   * POST /graph/configs
   * Save a graph configuration with proposal
   *
   * Body:
   * - name: Configuration name
   * - input: ProposalInput (profile, goals, context, trustedSources)
   * - proposal: GraphProposal (from /propose endpoint)
   * - createdBy: User ID
   */
  fastify.post<{
    Body: {
      name: string;
      input: ProposalInput;
      proposal: any;
      createdBy: string;
    };
  }>(
    "/configs",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "input", "proposal", "createdBy"],
          properties: {
            name: { type: "string" },
            input: { type: "object" },
            proposal: { type: "object" },
            createdBy: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { name, input, proposal, createdBy } = request.body;

        // Save to database
        const result = await saveGraphProposal(name, input, proposal, createdBy);

        return {
          success: true,
          ...result,
          message: "Graph configuration saved successfully",
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        fastify.log.error("Failed to save configuration:", error);
        reply.code(500);
        return {
          error: "Failed to save configuration",
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  /**
   * GET /graph/configs
   * List all graph configurations
   */
  fastify.get("/configs", async (request, reply) => {
    try {
      const configs = await prisma.graphConfig.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          versions: {
            orderBy: { version: "desc" },
            take: 1, // Latest version only
          },
        },
      });

      return {
        success: true,
        configs,
        count: configs.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      fastify.log.error("Failed to list configurations:", error);
      reply.code(500);
      return {
        error: "Failed to list configurations",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  /**
   * GET /graph/configs/:id
   * Get a specific graph configuration with all versions
   */
  fastify.get<{
    Params: { id: string };
  }>("/configs/:id", async (request, reply) => {
    try {
      const { id } = request.params;

      const config = await prisma.graphConfig.findUnique({
        where: { id },
        include: {
          versions: {
            orderBy: { version: "desc" },
          },
          syncRuns: {
            orderBy: { createdAt: "desc" },
            take: 10, // Last 10 runs
          },
        },
      });

      if (!config) {
        reply.code(404);
        return {
          error: "Configuration not found",
          message: `No configuration found with ID: ${id}`,
        };
      }

      return {
        success: true,
        config,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      fastify.log.error("Failed to get configuration:", error);
      reply.code(500);
      return {
        error: "Failed to get configuration",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  /**
   * POST /graph/configs/:id/versions/:versionId/templates
   * Generate Cypher templates for a configuration version
   *
   * Query parameters:
   * - environment: "STAGING" or "PRODUCTION" (default: STAGING)
   */
  fastify.post<{
    Params: { id: string; versionId: string };
    Querystring: { environment?: GraphEnvironment };
  }>(
    "/configs/:id/versions/:versionId/templates",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            environment: {
              type: "string",
              enum: ["STAGING", "PRODUCTION"],
              default: "STAGING",
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id, versionId } = request.params;
        const { environment = "STAGING" } = request.query;

        // Get the configuration version
        const version = await prisma.graphConfigVersion.findUnique({
          where: { id: versionId },
          include: {
            config: true,
          },
        });

        if (!version || version.configId !== id) {
          reply.code(404);
          return {
            error: "Version not found",
            message: `No version found with ID: ${versionId}`,
          };
        }

        // Extract graph model and mapping rules
        const graphModel = version.graphModel as any;
        const mappingRules = (version.pgToGraphMapping as any).rules;

        if (!graphModel || !graphModel.nodes || !graphModel.relationships) {
          reply.code(400);
          return {
            error: "Invalid graph model",
            message: "Graph model is missing nodes or relationships",
          };
        }

        // Generate Cypher templates
        const templates = generateCypherTemplates(
          graphModel.nodes,
          graphModel.relationships,
          mappingRules,
          environment
        );

        // Validate templates
        const validationResults: Record<string, any> = {};
        for (const [label, template] of Object.entries(templates.nodes)) {
          const validation = validateTemplate(template.cypher);
          validationResults[label] = validation;
          if (!validation.valid) {
            fastify.log.warn(`Template validation failed for ${label}:`, validation.errors);
          }
        }

        // Save templates to database
        await saveCypherTemplates(versionId, templates);

        // Create audit log
        await prisma.graphAudit.create({
          data: {
            configId: id,
            versionId,
            action: "templates.generated",
            actor: "system", // TODO: Get from auth
            metadata: {
              environment,
              nodeCount: Object.keys(templates.nodes).length,
              relationshipCount: Object.keys(templates.relationships).length,
              timestamp: new Date().toISOString(),
            },
          },
        });

        return {
          success: true,
          templates,
          validationResults,
          environment,
          message: "Cypher templates generated and saved successfully",
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        fastify.log.error("Failed to generate templates:", error);
        reply.code(500);
        return {
          error: "Failed to generate templates",
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  /**
   * GET /graph/visualize
   * Get graph data for visualization
   *
   * Query parameters:
   * - environment: "STAGING" or "PRODUCTION" (default: STAGING)
   * - limit: Maximum number of nodes to return (default: 100)
   * - label: Filter by node label (optional)
   * - scope: Filter by therapeutic scope: "pediatric_oncology", "oncology", or "all" (default: "pediatric_oncology")
   *
   * Returns data in react-force-graph format: { nodes: [], links: [] }
   */
  fastify.get<{
    Querystring: {
      environment?: GraphEnvironment;
      limit?: number;
      label?: string;
      scope?: "pediatric_oncology" | "oncology" | "all";
    };
  }>(
    "/visualize",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            environment: {
              type: "string",
              enum: ["STAGING", "PRODUCTION"],
              default: "STAGING",
            },
            limit: {
              type: "number",
              default: 100,
              minimum: 1,
              maximum: 500,
            },
            label: { type: "string" },
            scope: {
              type: "string",
              enum: ["pediatric_oncology", "oncology", "all"],
              default: "pediatric_oncology",
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { environment = "STAGING", limit = 100, label, scope = "pediatric_oncology" } = request.query;

        // Build scope filter
        const prefix = environment === "STAGING" ? "_stg_" : "";
        let scopeFilter = "";

        if (scope === "pediatric_oncology") {
          // Only pediatric oncology drugs and related nodes
          scopeFilter = `
            WHERE (
              (n:${prefix}Drug AND n.therapeuticArea = 'Pediatric Oncology')
              OR (n:${prefix}TherapeuticArea AND n.name = 'Pediatric Oncology')
              OR (n:${prefix}Decision)
              OR (n:${prefix}Agency)
              OR (n:${prefix}SafetyAlert)
              OR (n:${prefix}NewsItem)
              OR (n:${prefix}Guidance)
            )
          `;
        } else if (scope === "oncology") {
          // All oncology (pediatric + general)
          scopeFilter = `
            WHERE (
              (n:${prefix}Drug AND (n.therapeuticArea = 'Pediatric Oncology' OR n.therapeuticArea = 'Oncology'))
              OR (n:${prefix}TherapeuticArea AND (n.name = 'Pediatric Oncology' OR n.name = 'Oncology'))
              OR (n:${prefix}Decision)
              OR (n:${prefix}Agency)
              OR (n:${prefix}SafetyAlert)
              OR (n:${prefix}NewsItem)
              OR (n:${prefix}Guidance)
            )
          `;
        }
        // For scope === "all", no filter (show everything)

        // Build Cypher query based on parameters
        const labelFilter = label ? `:${label}` : "";
        const cypherQuery = `
          MATCH (n${labelFilter})
          ${scopeFilter}
          OPTIONAL MATCH (n)-[r]->(m)
          ${scopeFilter ? scopeFilter.replace(/n\./g, 'm.').replace(/n:/g, 'm:') : ''}
          WITH n, collect({rel: r, target: m}) as rels
          RETURN
            n,
            rels
          LIMIT $limit
        `;

        const result = await neo4jService.executeReadQuery(
          cypherQuery,
          { limit: neo4j.int(limit) },
          environment
        );

        // Transform Neo4j data to react-force-graph format
        const nodesMap = new Map();
        const links: any[] = [];

        result.records.forEach((record) => {
          const node = record.get("n");
          const rels = record.get("rels");

          // Add source node
          if (node && node.identity) {
            const nodeId = node.identity.toString();
            if (!nodesMap.has(nodeId)) {
              const labels = node.labels || [];
              const props = node.properties || {};

              // Create display name based on node type
              let displayName = props.name || props.title || props.drugName || nodeId;

              // For Trial nodes, include location and phase if available
              if (labels.includes('Trial') || labels.includes('_stg_Trial')) {
                const location = props.location && props.location !== 'Location Unknown' ? props.location : null;
                const phase = props.phase && props.phase !== 'Unknown' ? props.phase : null;

                if (location && phase) {
                  displayName = `${phase} - ${location}`;
                } else if (location) {
                  displayName = `${props.title || 'Trial'} (${location})`;
                } else if (phase) {
                  displayName = `${phase} Trial`;
                }
              }

              // Sanitize props: convert objects to strings to prevent React rendering errors
              const sanitizedProps: Record<string, any> = {};
              for (const [key, value] of Object.entries(props)) {
                if (value === null || value === undefined) {
                  sanitizedProps[key] = value;
                } else if (typeof value === 'object') {
                  // Convert objects/arrays to JSON strings
                  sanitizedProps[key] = JSON.stringify(value);
                } else {
                  sanitizedProps[key] = value;
                }
              }

              nodesMap.set(nodeId, {
                id: nodeId,
                label: labels[0] || "Unknown",
                labels: labels,
                name: displayName,
                group: labels[0] || "default",
                ...sanitizedProps,
              });
            }
          }

          // Add relationships and target nodes
          if (rels && Array.isArray(rels)) {
            rels.forEach((relObj: any) => {
              // Check for null/undefined explicitly - Neo4j objects might not be truthy
              if (relObj.rel !== null && relObj.rel !== undefined &&
                  relObj.target !== null && relObj.target !== undefined) {
                const rel = relObj.rel;
                const target = relObj.target;

                // Add target node
                const targetId = target.identity.toString();
                if (!nodesMap.has(targetId)) {
                  const targetLabels = target.labels || [];
                  const targetProps = target.properties || {};

                  // Create display name for target node
                  let targetDisplayName = targetProps.name || targetProps.title || targetProps.drugName || targetId;

                  // For Trial nodes, include location and phase if available
                  if (targetLabels.includes('Trial') || targetLabels.includes('_stg_Trial')) {
                    const location = targetProps.location && targetProps.location !== 'Location Unknown' ? targetProps.location : null;
                    const phase = targetProps.phase && targetProps.phase !== 'Unknown' ? targetProps.phase : null;

                    if (location && phase) {
                      targetDisplayName = `${phase} - ${location}`;
                    } else if (location) {
                      targetDisplayName = `${targetProps.title || 'Trial'} (${location})`;
                    } else if (phase) {
                      targetDisplayName = `${phase} Trial`;
                    }
                  }

                  // Sanitize target props: convert objects to strings to prevent React rendering errors
                  const sanitizedTargetProps: Record<string, any> = {};
                  for (const [key, value] of Object.entries(targetProps)) {
                    if (value === null || value === undefined) {
                      sanitizedTargetProps[key] = value;
                    } else if (typeof value === 'object') {
                      // Convert objects/arrays to JSON strings
                      sanitizedTargetProps[key] = JSON.stringify(value);
                    } else {
                      sanitizedTargetProps[key] = value;
                    }
                  }

                  nodesMap.set(targetId, {
                    id: targetId,
                    label: targetLabels[0] || "Unknown",
                    labels: targetLabels,
                    name: targetDisplayName,
                    group: targetLabels[0] || "default",
                    ...sanitizedTargetProps,
                  });
                }

                // Add link
                const sourceId = node.identity.toString();
                links.push({
                  source: sourceId,
                  target: targetId,
                  type: rel.type,
                  label: rel.type,
                  ...rel.properties,
                });
              }
            });
          }
        });

        const nodes = Array.from(nodesMap.values());

        return {
          environment,
          nodes,
          links,
          nodeCount: nodes.length,
          linkCount: links.length,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        fastify.log.error("Visualization query failed:", error);
        reply.code(500);
        return {
          error: "Failed to get visualization data",
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  /**
   * POST /graph/backfill
   * Backfill all approved data from PostgreSQL to Neo4j
   *
   * Body:
   * - environment: "STAGING" or "PRODUCTION" (default: STAGING)
   * - dryRun: boolean (default: false)
   */
  fastify.post<{
    Body: {
      environment?: GraphEnvironment;
      dryRun?: boolean;
    };
  }>(
    "/backfill",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            environment: {
              type: "string",
              enum: ["STAGING", "PRODUCTION"],
              default: "STAGING",
            },
            dryRun: {
              type: "boolean",
              default: false,
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { environment = "STAGING", dryRun = false } = request.body || {};

        fastify.log.info(
          `Starting backfill to ${environment}${dryRun ? " (DRY RUN)" : ""}...`
        );

        const result = await graphBackfillService.backfillAll({
          environment,
          dryRun,
        });

        if (!result.success) {
          reply.code(500);
          return {
            success: false,
            error: "Backfill failed",
            errors: result.errors,
          };
        }

        return {
          success: true,
          environment,
          dryRun,
          nodesCreated: result.nodesCreated,
          relationshipsCreated: result.relationshipsCreated,
          summary: result.summary,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        fastify.log.error("Backfill failed:", error);
        reply.code(500);
        return {
          success: false,
          error: "Backfill failed",
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );
};
