/**
 * Graph Backfill Service
 *
 * Syncs approved data from PostgreSQL views to Neo4j graph database
 */

import { prisma } from "@regintel/database";
import { neo4jService } from "./neo4jService.js";
import type { GraphEnvironment } from "@regintel/database";

interface BackfillOptions {
  environment: GraphEnvironment;
  batchSize?: number;
  dryRun?: boolean;
}

interface BackfillResult {
  success: boolean;
  nodesCreated: number;
  relationshipsCreated: number;
  errors: string[];
  summary: {
    drugs: number;
    decisions: number;
    trials: number;
    guidance: number;
    news: number;
  };
}

export class GraphBackfillService {
  /**
   * Backfill all approved data from PostgreSQL to Neo4j
   */
  async backfillAll(options: BackfillOptions): Promise<BackfillResult> {
    const { environment, dryRun = false } = options;
    const result: BackfillResult = {
      success: true,
      nodesCreated: 0,
      relationshipsCreated: 0,
      errors: [],
      summary: { drugs: 0, decisions: 0, trials: 0, guidance: 0, news: 0 },
    };

    console.log(`[Backfill] Starting backfill to ${environment}${dryRun ? ' (DRY RUN)' : ''}...`);

    try {
      // 1. Backfill Drugs
      const drugsResult = await this.backfillDrugs(environment, dryRun);
      result.summary.drugs = drugsResult.count;
      result.nodesCreated += drugsResult.count;

      // 2. Backfill Decisions
      const decisionsResult = await this.backfillDecisions(environment, dryRun);
      result.summary.decisions = decisionsResult.count;
      result.nodesCreated += decisionsResult.count;

      // 3. Backfill Trials
      const trialsResult = await this.backfillTrials(environment, dryRun);
      result.summary.trials = trialsResult.count;
      result.nodesCreated += trialsResult.count;

      // 4. Backfill Guidance
      const guidanceResult = await this.backfillGuidance(environment, dryRun);
      result.summary.guidance = guidanceResult.count;
      result.nodesCreated += guidanceResult.count;

      // 5. Backfill News
      const newsResult = await this.backfillNews(environment, dryRun);
      result.summary.news = newsResult.count;
      result.nodesCreated += newsResult.count;

      // 6. Create Agency Nodes
      if (!dryRun) {
        await this.createAgencyNodes(environment);
      }

      // 7. Create TherapeuticArea Nodes
      if (!dryRun) {
        await this.createTherapeuticAreaNodes(environment);
      }

      // 8. Separate Safety Alerts from News
      if (!dryRun) {
        await this.separateSafetyAlerts(environment);
      }

      // 9. Create Rich Relationships
      if (!dryRun) {
        const relsResult = await this.createRelationships(environment);
        result.relationshipsCreated = relsResult.count;
      }

      console.log(`[Backfill] Completed successfully:`, result.summary);
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
      console.error(`[Backfill] Failed:`, error);
    }

    return result;
  }

  /**
   * Create Agency nodes (FDA, EMA, PMDA, etc.)
   */
  private async createAgencyNodes(environment: GraphEnvironment): Promise<void> {
    const prefix = environment === "STAGING" ? "_stg_" : "";

    // Get distinct agencies from all sources (decisions, guidance, AND news/press)
    const agencies = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT agency, agency_domain
      FROM vw_approved_decisions
      WHERE agency IS NOT NULL
      UNION
      SELECT DISTINCT agency, "sourceDomain" as agency_domain
      FROM vw_approved_guidance
      WHERE agency IS NOT NULL
      UNION
      SELECT DISTINCT
        CASE
          WHEN "sourceDomain" LIKE '%fda.gov%' THEN 'FDA'
          WHEN "sourceDomain" LIKE '%ema.europa.eu%' THEN 'EMA'
          WHEN "sourceDomain" LIKE '%pmda.go.jp%' THEN 'PMDA'
          ELSE 'OTHER'
        END as agency,
        "sourceDomain" as agency_domain
      FROM vw_approved_news
      WHERE "sourceDomain" IS NOT NULL
        AND ("sourceDomain" LIKE '%fda.gov%'
             OR "sourceDomain" LIKE '%ema.europa.eu%'
             OR "sourceDomain" LIKE '%pmda.go.jp%')
    `;

    console.log(`[Backfill] Creating ${agencies.length} agency nodes`);

    for (const agency of agencies) {
      const code = agency.agency?.toUpperCase() || "UNKNOWN";
      const cypher = `
        MERGE (a:${prefix}Agency {code: $code})
        ON CREATE SET
          a.name = $name,
          a.domain = $domain,
          a.syncedAt = datetime()
        RETURN a.code
      `;

      await neo4jService.executeWriteQuery(
        cypher,
        {
          code,
          name: agency.agency || "Unknown Agency",
          domain: agency.agency_domain || "",
        },
        environment
      );
    }
  }

  /**
   * Create TherapeuticArea nodes
   */
  private async createTherapeuticAreaNodes(environment: GraphEnvironment): Promise<void> {
    const prefix = environment === "STAGING" ? "_stg_" : "";

    const areas = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT therapeutic_area
      FROM vw_approved_drugs
      WHERE therapeutic_area IS NOT NULL
        AND therapeutic_area != 'Unknown'
    `;

    console.log(`[Backfill] Creating ${areas.length} therapeutic area nodes`);

    for (const area of areas) {
      const cypher = `
        MERGE (ta:${prefix}TherapeuticArea {name: $name})
        ON CREATE SET
          ta.category = $category,
          ta.syncedAt = datetime()
        RETURN ta.name
      `;

      await neo4jService.executeWriteQuery(
        cypher,
        {
          name: area.therapeutic_area,
          category: area.therapeutic_area.includes("Oncology") ? "Oncology" : "Other",
        },
        environment
      );
    }
  }

  /**
   * Separate Safety Alerts from News Items
   */
  private async separateSafetyAlerts(environment: GraphEnvironment): Promise<void> {
    const prefix = environment === "STAGING" ? "_stg_" : "";

    // Get high-severity news items to convert to SafetyAlert nodes
    const alerts = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM vw_approved_news
      WHERE alert_type IN ('Safety Alert', 'Recall', 'Warning Letter')
        OR severity IN ('High', 'Medium')
    `;

    console.log(`[Backfill] Creating ${alerts.length} safety alert nodes`);

    for (const alert of alerts) {
      const cypher = `
        MERGE (sa:${prefix}SafetyAlert {alertId: $alertId})
        ON CREATE SET
          sa.title = $title,
          sa.publishedDate = datetime($publishedDate),
          sa.type = $type,
          sa.severity = $severity,
          sa.drugNameRaw = $drugNameRaw,
          sa.url = $url,
          sa.sourceDomain = $sourceDomain,
          sa.approvalStatus = 'APPROVED',
          sa.approvedBy = $approvedBy,
          sa.approvedAt = datetime($approvedAt),
          sa.syncedAt = datetime()
        RETURN sa.alertId
      `;

      await neo4jService.executeWriteQuery(
        cypher,
        {
          alertId: alert.alert_id,
          title: alert.title || "Unknown Alert",
          publishedDate: alert.published_date?.toISOString() || new Date().toISOString(),
          type: alert.alert_type || "ALERT",
          severity: alert.severity || "Low",
          drugNameRaw: alert.drug_name_raw || "",
          url: alert.url,
          sourceDomain: alert.sourceDomain || "",
          approvedBy: alert.approved_by,
          approvedAt: alert.approved_at?.toISOString() || new Date().toISOString(),
        },
        environment
      );
    }
  }

  /**
   * Backfill Drug nodes from vw_approved_drugs
   */
  private async backfillDrugs(
    environment: GraphEnvironment,
    dryRun: boolean
  ): Promise<{ count: number }> {
    const prefix = environment === "STAGING" ? "_stg_" : "";

    // Fetch data from PostgreSQL
    const drugs = await prisma.$queryRaw<any[]>`
      SELECT
        drug_id,
        drug_name,
        therapeutic_area,
        approved_date,
        biomarkers,
        url,
        "sourceDomain",
        approved_by,
        approved_at
      FROM vw_approved_drugs
    `;

    console.log(`[Backfill] Found ${drugs.length} drugs to sync`);

    if (dryRun) {
      return { count: drugs.length };
    }

    // Create nodes in Neo4j
    for (const drug of drugs) {
      const cypher = `
        MERGE (n:${prefix}Drug {drugId: $drugId})
        ON CREATE SET
          n.name = $name,
          n.therapeuticArea = $therapeuticArea,
          n.approvedDate = datetime($approvedDate),
          n.biomarkers = $biomarkers,
          n.url = $url,
          n.sourceDomain = $sourceDomain,
          n.approvalStatus = 'APPROVED',
          n.approvedBy = $approvedBy,
          n.approvedAt = datetime($approvedAt),
          n.syncedAt = datetime()
        ON MATCH SET
          n.name = $name,
          n.therapeuticArea = $therapeuticArea,
          n.approvedDate = datetime($approvedDate),
          n.biomarkers = $biomarkers,
          n.url = $url,
          n.updatedAt = datetime()
        RETURN n.drugId as id
      `;

      await neo4jService.executeWriteQuery(
        cypher,
        {
          drugId: drug.drug_id,
          name: drug.drug_name || "Unknown",
          therapeuticArea: drug.therapeutic_area || "Unknown",
          approvedDate: drug.approved_date?.toISOString() || new Date().toISOString(),
          biomarkers: drug.biomarkers || "",
          url: drug.url,
          sourceDomain: drug.sourceDomain,
          approvedBy: drug.approved_by,
          approvedAt: drug.approved_at?.toISOString() || new Date().toISOString(),
        },
        environment
      );
    }

    return { count: drugs.length };
  }

  /**
   * Backfill Decision nodes from vw_approved_decisions
   */
  private async backfillDecisions(
    environment: GraphEnvironment,
    dryRun: boolean
  ): Promise<{ count: number }> {
    const prefix = environment === "STAGING" ? "_stg_" : "";

    const decisions = await prisma.$queryRaw<any[]>`
      SELECT
        decision_id,
        title,
        decision_date,
        decision_type,
        agency,
        agency_domain,
        drug_name_raw,
        url,
        approved_by,
        approved_at
      FROM vw_approved_decisions
    `;

    console.log(`[Backfill] Found ${decisions.length} decisions to sync`);

    if (dryRun) {
      return { count: decisions.length };
    }

    for (const decision of decisions) {
      const cypher = `
        MERGE (n:${prefix}Decision {decisionId: $decisionId})
        ON CREATE SET
          n.title = $title,
          n.decisionDate = datetime($decisionDate),
          n.type = $type,
          n.agency = $agency,
          n.agencyDomain = $agencyDomain,
          n.drugNameRaw = $drugNameRaw,
          n.url = $url,
          n.approvalStatus = 'APPROVED',
          n.approvedBy = $approvedBy,
          n.approvedAt = datetime($approvedAt),
          n.syncedAt = datetime()
        ON MATCH SET
          n.title = $title,
          n.decisionDate = datetime($decisionDate),
          n.type = $type,
          n.updatedAt = datetime()
        RETURN n.decisionId as id
      `;

      await neo4jService.executeWriteQuery(
        cypher,
        {
          decisionId: decision.decision_id,
          title: decision.title || "Unknown Decision",
          decisionDate: decision.decision_date?.toISOString() || new Date().toISOString(),
          type: decision.decision_type || "UNKNOWN",
          agency: decision.agency || "Unknown",
          agencyDomain: decision.agency_domain || "",
          drugNameRaw: decision.drug_name_raw || "",
          url: decision.url,
          approvedBy: decision.approved_by,
          approvedAt: decision.approved_at?.toISOString() || new Date().toISOString(),
        },
        environment
      );
    }

    return { count: decisions.length };
  }

  /**
   * Backfill Trial nodes from vw_approved_trials
   */
  private async backfillTrials(
    environment: GraphEnvironment,
    dryRun: boolean
  ): Promise<{ count: number }> {
    const prefix = environment === "STAGING" ? "_stg_" : "";

    const trials = await prisma.$queryRaw<any[]>`
      SELECT
        trial_id,
        title,
        meeting_date,
        drug_name_raw,
        phase,
        trial_status,
        url,
        "sourceDomain",
        approved_by,
        approved_at
      FROM vw_approved_trials
    `;

    console.log(`[Backfill] Found ${trials.length} trials to sync`);

    if (dryRun) {
      return { count: trials.length };
    }

    for (const trial of trials) {
      // Extract location from title if available
      // Pattern: "...in City, State" or "...at Location" or "Committee in City"
      const location = this.extractLocation(trial.title || "");

      // Create a display name that includes trial info
      const displayName = this.formatTrialName(trial.title, location, trial.phase);

      const cypher = `
        MERGE (n:${prefix}Trial {trialId: $trialId})
        ON CREATE SET
          n.name = $name,
          n.title = $title,
          n.location = $location,
          n.phase = $phase,
          n.status = $status,
          n.meetingDate = datetime($meetingDate),
          n.drugNameRaw = $drugNameRaw,
          n.url = $url,
          n.sourceDomain = $sourceDomain,
          n.approvalStatus = 'APPROVED',
          n.approvedBy = $approvedBy,
          n.approvedAt = datetime($approvedAt),
          n.syncedAt = datetime()
        ON MATCH SET
          n.name = $name,
          n.title = $title,
          n.location = $location,
          n.phase = $phase,
          n.status = $status,
          n.meetingDate = datetime($meetingDate),
          n.updatedAt = datetime()
        RETURN n.trialId as id
      `;

      await neo4jService.executeWriteQuery(
        cypher,
        {
          trialId: trial.trial_id,
          name: displayName,
          title: trial.title || "Unknown Trial",
          location: location || "Location Unknown",
          phase: trial.phase || "Unknown",
          status: trial.trial_status || "Unknown",
          meetingDate: trial.meeting_date?.toISOString() || new Date().toISOString(),
          drugNameRaw: trial.drug_name_raw || "",
          url: trial.url,
          sourceDomain: trial.sourceDomain || "",
          approvedBy: trial.approved_by,
          approvedAt: trial.approved_at?.toISOString() || new Date().toISOString(),
        },
        environment
      );
    }

    return { count: trials.length };
  }

  /**
   * Extract location from trial title
   * Looks for patterns like "in City", "at Location", "Committee in City"
   */
  private extractLocation(title: string): string | null {
    // Pattern 1: "... in City, Country" or "... in City"
    const inPattern = /\b(?:in|at)\s+([A-Z][a-z]+(?:[\s,]+[A-Z][a-z]+)*)/;
    const inMatch = title.match(inPattern);
    if (inMatch) {
      return inMatch[1];
    }

    // Pattern 2: Extract from EMA/FDA meeting locations
    // Example: "CHMP meeting - Amsterdam" or "FDA Meeting, Silver Spring, MD"
    const locationPattern = /[-–]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/;
    const locationMatch = title.match(locationPattern);
    if (locationMatch) {
      return locationMatch[1];
    }

    return null;
  }

  /**
   * Format a trial name for display
   * Example: "Phase 3 Trial in New York" or "CHMP Meeting (Amsterdam)"
   */
  private formatTrialName(title: string | null, location: string | null, phase: string | null): string {
    if (!title) {
      return "Unknown Trial";
    }

    // Shorten long titles
    let shortTitle = title;
    if (title.length > 60) {
      shortTitle = title.substring(0, 57) + "...";
    }

    // Add phase prefix if available and not already in title
    if (phase && phase !== 'Unknown' && !title.toLowerCase().includes('phase')) {
      shortTitle = `${phase}: ${shortTitle}`;
    }

    // Add location if available and not already in title
    if (location && !title.toLowerCase().includes(location.toLowerCase())) {
      return `${shortTitle} (${location})`;
    }

    return shortTitle;
  }

  /**
   * Backfill Guidance nodes from vw_approved_guidance
   */
  private async backfillGuidance(
    environment: GraphEnvironment,
    dryRun: boolean
  ): Promise<{ count: number }> {
    const prefix = environment === "STAGING" ? "_stg_" : "";

    const guidance = await prisma.$queryRaw<any[]>`
      SELECT
        guidance_id,
        title,
        issued_date,
        agency,
        category,
        url,
        "sourceDomain",
        approved_by,
        approved_at
      FROM vw_approved_guidance
    `;

    console.log(`[Backfill] Found ${guidance.length} guidance documents to sync`);

    if (dryRun) {
      return { count: guidance.length };
    }

    for (const doc of guidance) {
      const cypher = `
        MERGE (n:${prefix}Guidance {guidanceId: $guidanceId})
        ON CREATE SET
          n.title = $title,
          n.issuedDate = datetime($issuedDate),
          n.agency = $agency,
          n.category = $category,
          n.url = $url,
          n.sourceDomain = $sourceDomain,
          n.approvalStatus = 'APPROVED',
          n.approvedBy = $approvedBy,
          n.approvedAt = datetime($approvedAt),
          n.syncedAt = datetime()
        ON MATCH SET
          n.title = $title,
          n.issuedDate = datetime($issuedDate),
          n.updatedAt = datetime()
        RETURN n.guidanceId as id
      `;

      await neo4jService.executeWriteQuery(
        cypher,
        {
          guidanceId: doc.guidance_id,
          title: doc.title || "Unknown Guidance",
          issuedDate: doc.issued_date?.toISOString() || new Date().toISOString(),
          agency: doc.agency || "Unknown",
          category: doc.category || "General",
          url: doc.url,
          sourceDomain: doc.sourceDomain || "",
          approvedBy: doc.approved_by,
          approvedAt: doc.approved_at?.toISOString() || new Date().toISOString(),
        },
        environment
      );
    }

    return { count: guidance.length };
  }

  /**
   * Backfill News nodes from vw_approved_news
   */
  private async backfillNews(
    environment: GraphEnvironment,
    dryRun: boolean
  ): Promise<{ count: number }> {
    const prefix = environment === "STAGING" ? "_stg_" : "";

    const news = await prisma.$queryRaw<any[]>`
      SELECT
        alert_id,
        title,
        published_date,
        alert_type,
        severity,
        drug_name_raw,
        agency,
        url,
        "sourceDomain",
        approved_by,
        approved_at
      FROM vw_approved_news
    `;

    console.log(`[Backfill] Found ${news.length} news items to sync`);

    if (dryRun) {
      return { count: news.length };
    }

    for (const item of news) {
      const cypher = `
        MERGE (n:${prefix}NewsItem {newsId: $newsId})
        ON CREATE SET
          n.title = $title,
          n.publishedDate = datetime($publishedDate),
          n.type = $type,
          n.severity = $severity,
          n.drugNameRaw = $drugNameRaw,
          n.agency = $agency,
          n.url = $url,
          n.sourceDomain = $sourceDomain,
          n.approvalStatus = 'APPROVED',
          n.approvedBy = $approvedBy,
          n.approvedAt = datetime($approvedAt),
          n.syncedAt = datetime()
        ON MATCH SET
          n.title = $title,
          n.publishedDate = datetime($publishedDate),
          n.agency = $agency,
          n.updatedAt = datetime()
        RETURN n.newsId as id
      `;

      await neo4jService.executeWriteQuery(
        cypher,
        {
          newsId: item.alert_id,
          title: item.title || "Unknown News",
          publishedDate: item.published_date?.toISOString() || new Date().toISOString(),
          type: item.alert_type || "PRESS",
          severity: item.severity || "INFO",
          drugNameRaw: item.drug_name_raw || "",
          agency: item.agency || "OTHER",
          url: item.url,
          sourceDomain: item.sourceDomain || "",
          approvedBy: item.approved_by,
          approvedAt: item.approved_at?.toISOString() || new Date().toISOString(),
        },
        environment
      );
    }

    return { count: news.length };
  }

  /**
   * Create relationships between nodes based on shared identifiers
   */
  private async createRelationships(environment: GraphEnvironment): Promise<{ count: number }> {
    const prefix = environment === "STAGING" ? "_stg_" : "";
    let count = 0;

    console.log(`[Backfill] Creating rich relationships...`);

    // 1. Link Decisions to Drugs (SUBJECT_OF)
    const linkDecisionsToDrugs = `
      MATCH (dec:${prefix}Decision)
      MATCH (drug:${prefix}Drug)
      WHERE dec.drugNameRaw IS NOT NULL
        AND drug.name IS NOT NULL
        AND toLower(dec.drugNameRaw) CONTAINS toLower(drug.name)
      MERGE (drug)-[r:SUBJECT_OF]->(dec)
      ON CREATE SET r.createdAt = datetime()
      RETURN count(r) as count
    `;
    const r1 = await neo4jService.executeWriteQuery(linkDecisionsToDrugs, {}, environment);
    count += r1.records[0]?.get("count")?.toNumber() || 0;

    // 2. Link Decisions to Agencies (ISSUED_BY)
    const linkDecisionsToAgencies = `
      MATCH (dec:${prefix}Decision)
      MATCH (a:${prefix}Agency)
      WHERE dec.agency IS NOT NULL
        AND a.code = toUpper(dec.agency)
      MERGE (dec)-[r:ISSUED_BY]->(a)
      ON CREATE SET r.createdAt = datetime()
      RETURN count(r) as count
    `;
    const r2 = await neo4jService.executeWriteQuery(linkDecisionsToAgencies, {}, environment);
    count += r2.records[0]?.get("count")?.toNumber() || 0;

    // 3. Link Drugs to Agencies (APPROVED_BY) - via Decisions
    const linkDrugsToAgencies = `
      MATCH (drug:${prefix}Drug)-[:SUBJECT_OF]->(dec:${prefix}Decision)-[:ISSUED_BY]->(a:${prefix}Agency)
      WHERE dec.type = 'APPROVAL'
      MERGE (drug)-[r:APPROVED_BY]->(a)
      ON CREATE SET
        r.createdAt = datetime(),
        r.approvalDate = dec.decisionDate
      RETURN count(r) as count
    `;
    const r3 = await neo4jService.executeWriteQuery(linkDrugsToAgencies, {}, environment);
    count += r3.records[0]?.get("count")?.toNumber() || 0;

    // 4. Link Drugs to TherapeuticAreas (TREATS)
    const linkDrugsToTherapeuticAreas = `
      MATCH (drug:${prefix}Drug)
      MATCH (ta:${prefix}TherapeuticArea)
      WHERE drug.therapeuticArea IS NOT NULL
        AND ta.name = drug.therapeuticArea
      MERGE (drug)-[r:TREATS]->(ta)
      ON CREATE SET r.createdAt = datetime()
      RETURN count(r) as count
    `;
    const r4 = await neo4jService.executeWriteQuery(linkDrugsToTherapeuticAreas, {}, environment);
    count += r4.records[0]?.get("count")?.toNumber() || 0;

    // 5. Link SafetyAlerts to Drugs (HAS_ALERT)
    const linkSafetyAlertsToDrugs = `
      MATCH (sa:${prefix}SafetyAlert)
      MATCH (drug:${prefix}Drug)
      WHERE sa.drugNameRaw IS NOT NULL
        AND drug.name IS NOT NULL
        AND toLower(sa.drugNameRaw) CONTAINS toLower(drug.name)
      MERGE (drug)-[r:HAS_ALERT]->(sa)
      ON CREATE SET
        r.createdAt = datetime(),
        r.severity = sa.severity
      RETURN count(r) as count
    `;
    const r5 = await neo4jService.executeWriteQuery(linkSafetyAlertsToDrugs, {}, environment);
    count += r5.records[0]?.get("count")?.toNumber() || 0;

    // 6. Link SafetyAlerts to Agencies (ISSUED_BY)
    const linkSafetyAlertsToAgencies = `
      MATCH (sa:${prefix}SafetyAlert)
      MATCH (a:${prefix}Agency)
      WHERE sa.sourceDomain IS NOT NULL
        AND toLower(sa.sourceDomain) CONTAINS toLower(a.domain)
      MERGE (sa)-[r:ISSUED_BY]->(a)
      ON CREATE SET r.createdAt = datetime()
      RETURN count(r) as count
    `;
    const r6 = await neo4jService.executeWriteQuery(linkSafetyAlertsToAgencies, {}, environment);
    count += r6.records[0]?.get("count")?.toNumber() || 0;

    // 7. Link Trials to Drugs (STUDIES)
    const linkTrialsToDrugs = `
      MATCH (trial:${prefix}Trial)
      MATCH (drug:${prefix}Drug)
      WHERE trial.drugNameRaw IS NOT NULL
        AND drug.name IS NOT NULL
        AND toLower(trial.drugNameRaw) CONTAINS toLower(drug.name)
      MERGE (trial)-[r:STUDIES]->(drug)
      ON CREATE SET r.createdAt = datetime()
      RETURN count(r) as count
    `;
    const r7 = await neo4jService.executeWriteQuery(linkTrialsToDrugs, {}, environment);
    count += r7.records[0]?.get("count")?.toNumber() || 0;

    // 7b. Link Trials to Agencies (HELD_BY) - based on sourceDomain
    const linkTrialsToAgencies = `
      MATCH (trial:${prefix}Trial)
      MATCH (a:${prefix}Agency)
      WHERE trial.sourceDomain IS NOT NULL
        AND (toLower(trial.sourceDomain) CONTAINS toLower(a.domain)
             OR (a.code = 'EMA' AND toLower(trial.sourceDomain) CONTAINS 'ema.europa.eu')
             OR (a.code = 'FDA' AND toLower(trial.sourceDomain) CONTAINS 'fda.gov')
             OR (a.code = 'PMDA' AND toLower(trial.sourceDomain) CONTAINS 'pmda.go.jp'))
      MERGE (trial)-[r:HELD_BY]->(a)
      ON CREATE SET r.createdAt = datetime()
      RETURN count(r) as count
    `;
    const r7b = await neo4jService.executeWriteQuery(linkTrialsToAgencies, {}, environment);
    count += r7b.records[0]?.get("count")?.toNumber() || 0;

    // 8. Link NewsItems to Drugs (MENTIONED_IN)
    const linkNewsToDrugs = `
      MATCH (news:${prefix}NewsItem)
      MATCH (drug:${prefix}Drug)
      WHERE news.drugNameRaw IS NOT NULL
        AND drug.name IS NOT NULL
        AND toLower(news.drugNameRaw) CONTAINS toLower(drug.name)
      MERGE (drug)-[r:MENTIONED_IN]->(news)
      ON CREATE SET r.createdAt = datetime()
      RETURN count(r) as count
    `;
    const r8 = await neo4jService.executeWriteQuery(linkNewsToDrugs, {}, environment);
    count += r8.records[0]?.get("count")?.toNumber() || 0;

    // 9. Link Guidance to Agencies (ISSUED_BY)
    const linkGuidanceToAgencies = `
      MATCH (g:${prefix}Guidance)
      MATCH (a:${prefix}Agency)
      WHERE g.agency IS NOT NULL
        AND a.code = toUpper(g.agency)
      MERGE (g)-[r:ISSUED_BY]->(a)
      ON CREATE SET r.createdAt = datetime()
      RETURN count(r) as count
    `;
    const r9 = await neo4jService.executeWriteQuery(linkGuidanceToAgencies, {}, environment);
    count += r9.records[0]?.get("count")?.toNumber() || 0;

    // 10. Link NewsItems to Agencies (ISSUED_BY) - using extracted agency field
    // This now includes third-party news mentioning agencies (e.g., FierceBiotech articles about FDA)
    const linkNewsToAgencies = `
      MATCH (news:${prefix}NewsItem)
      MATCH (a:${prefix}Agency)
      WHERE news.agency IS NOT NULL
        AND news.agency <> 'OTHER'
        AND a.code = news.agency
      MERGE (news)-[r:ISSUED_BY]->(a)
      ON CREATE SET r.createdAt = datetime()
      RETURN count(r) as count
    `;
    const r10 = await neo4jService.executeWriteQuery(linkNewsToAgencies, {}, environment);
    count += r10.records[0]?.get("count")?.toNumber() || 0;

    console.log(`[Backfill] Created ${count} relationships`);
    return { count };
  }
}

export const graphBackfillService = new GraphBackfillService();
