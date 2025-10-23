# Neo4j Graph Configuration System - Implementation Plan

## Overview

This document outlines the implementation of an Admin → Graph Config feature that allows non-technical admins to describe their analytical needs and automatically generate a Neo4j multidimensional graph model from PostgreSQL data.

## Core Principles

1. **Read-Only PostgreSQL**: Never alter existing ingestion/curation/scheduling
2. **MERGE-Only Neo4j**: No DELETE/DROP/DETACH operations
3. **Dry-Run First**: Always simulate before writing
4. **Schema-Agnostic**: Infer structure from admin input, not hardcoded
5. **Auditable**: Immutable change log for all operations
6. **✅ APPROVED DATA ONLY**: Only source items with `status = 'APPROVED'` are synced to Neo4j (curated, reviewed, and approved articles only)

## Architecture Components

### 1. Database Schema (PostgreSQL)

**Models** (already added to Prisma schema):
- `GraphConfig` - Main configuration record
- `GraphConfigVersion` - Versioned graph models
- `GraphSyncRun` - Track backfill/sync executions
- `GraphAudit` - Immutable audit log

**Status Flow**:
```
DRAFT → PROPOSED → STAGING → PRODUCTION
            ↓
        ARCHIVED
```

### 2. Neo4j Setup

**Docker Configuration**:
- Neo4j 5.15 Community Edition
- APOC and GDS plugins enabled
- Staging and Production databases
- Port 7474 (Browser), 7687 (Bolt)

**Connection**:
```typescript
import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'regintel123')
);
```

### 3. Backend API Endpoints

**Base Path**: `/admin/graph`

| Endpoint | Method | Purpose | Input | Output |
|----------|--------|---------|-------|--------|
| `/propose` | POST | Generate graph model from admin description | PROFILE, GOALS, CONTEXT, TRUSTED_SOURCES | SUMMARY, SUGGESTED_GRAPH_MODEL, PG_TO_GRAPH_MAPPING |
| `/render-cypher` | POST | Generate Cypher templates from model | Graph model JSON | CYPHER_TEMPLATES |
| `/dry-run` | POST | Simulate sync without writes | Config version ID | DRY_RUN_AND_DIFF_SPEC |
| `/backfill` | POST | Execute backfill to staging | Config version ID, filters | Sync run ID |
| `/promote` | POST | Promote staging → production | Config version ID | Success/failure |
| `/qa` | GET | Run QA validation queries | Config version ID, environment | VALIDATIONS_AND_QA results |
| `/configs` | GET | List all configurations | - | Array of configs |
| `/configs/:id` | GET | Get specific configuration | Config ID | Full config + versions |
| `/configs/:id/versions` | GET | List versions | Config ID | Array of versions |

### 4. Services

#### **GraphProposalService** (AI-Powered)
- Takes admin inputs (profile, goals, context)
- Calls OpenAI GPT-4 with structured prompt
- Returns proposed graph model (nodes, relationships, properties)
- Generates mapping from PostgreSQL views to Neo4j

**Key Functions**:
```typescript
async generateProposal(input: ProposalInput): Promise<GraphProposal>
async refineProposal(proposalId: string, feedback: string): Promise<GraphProposal>
```

#### **CypherTemplateService**
- Generates parameterized MERGE templates
- Handles staging vs production (label prefixes)
- Creates SET ON CREATE and SET for properties
- Validates Cypher syntax

**Key Functions**:
```typescript
async generateTemplates(graphModel: GraphModel): Promise<CypherTemplates>
async renderTemplate(template: string, params: object): Promise<string>
```

#### **GraphSyncService**
- Reads from PostgreSQL curated views (read-only)
- Writes to Neo4j using MERGE-only
- Batching and checkpointing
- Retry logic with exponential backoff

**Key Functions**:
```typescript
async dryRun(versionId: string): Promise<DiffReport>
async backfill(versionId: string, options: BackfillOptions): Promise<SyncRun>
async incrementalSync(versionId: string): Promise<SyncRun>
async promote(versionId: string): Promise<void>
```

#### **Neo4jConnectionService**
- Manages Neo4j driver connections
- Handles staging vs production databases
- Connection pooling
- Health checks

**Key Functions**:
```typescript
async executeCypher(query: string, params: object, environment: GraphEnvironment): Promise<Result>
async checkHealth(): Promise<boolean>
async closeAll(): Promise<void>
```

#### **GraphValidationService**
- Runs QA queries (read-only)
- Checks for orphan relationships
- Validates required properties
- Detects duplicate keys

**Key Functions**:
```typescript
async runQAQueries(versionId: string, environment: GraphEnvironment): Promise<QAResults>
async validateIntegrity(environment: GraphEnvironment): Promise<ValidationReport>
```

### 5. Frontend Admin UI

#### **Graph Config Dashboard** (`/admin/graph`)
- List all configurations
- Create new configuration
- View configuration details
- Manage versions

#### **Configuration Wizard** (`/admin/graph/new`)
**Step 1: Profile & Goals**
- Text area for industry/company/focus
- Checklist for visualization goals
- Optional context field
- Select trusted sources

**Step 2: Review Proposal**
- Display AI-generated summary (bullet points)
- Show proposed nodes and relationships
- Display mapping rules (PostgreSQL → Neo4j)
- Approve or request refinements

**Step 3: Dry Run**
- Click "Run Dry-Run"
- Show diff report (nodes/rels to create/update)
- Display sample records
- Download JSON report

**Step 4: Backfill**
- Configure batch size
- Select target environment (staging only)
- Monitor progress bar
- View logs in real-time

**Step 5: Promote**
- Review staging data
- Click "Promote to Production"
- Confirm action
- Success notification

#### **Components**:
- `GraphConfigList.tsx` - List view
- `GraphConfigWizard.tsx` - Multi-step wizard
- `GraphModelViewer.tsx` - Visual graph schema
- `DryRunDiffViewer.tsx` - Diff report display
- `SyncProgress.tsx` - Real-time progress
- `QAReportViewer.tsx` - QA results display

### 6. RBAC & Security

**Roles**:
- `VIEWER` - Read graph configs and reports
- `DESIGNER` - Create and edit configurations
- `DEPLOYER` - Execute backfills and promotions
- `AUDITOR` - View audit logs only

**Permissions Matrix**:
| Action | VIEWER | DESIGNER | DEPLOYER | AUDITOR |
|--------|--------|----------|----------|---------|
| List configs | ✅ | ✅ | ✅ | ✅ |
| Create config | ❌ | ✅ | ✅ | ❌ |
| Edit config | ❌ | ✅ | ✅ | ❌ |
| View proposal | ✅ | ✅ | ✅ | ✅ |
| Dry run | ❌ | ✅ | ✅ | ❌ |
| Backfill | ❌ | ❌ | ✅ | ❌ |
| Promote | ❌ | ❌ | ✅ | ❌ |
| View audit | ❌ | ❌ | ❌ | ✅ |

**Implementation**:
- Middleware checks user role
- API endpoints enforce permissions
- Audit log records all actions

### 7. Data Flow

#### **Proposal Generation**:
```
Admin Input → GraphProposalService → OpenAI GPT-4
    ↓
Graph Model JSON → Store in GraphConfigVersion
    ↓
CypherTemplateService → Generate MERGE templates
```

#### **Dry Run**:
```
Config Version → Read PostgreSQL views
    ↓
Generate node/rel keys → Check existence in Neo4j
    ↓
Build diff report → Return to UI (no writes)
```

#### **Backfill**:
```
Config Version → Read PostgreSQL in batches (APPROVED ONLY!)
    ↓
    WHERE status = 'APPROVED' ← ENFORCED FILTER
    ↓
For each batch:
  → Generate Cypher from templates
  → Execute MERGE to Neo4j staging
  → Update checkpoint
    ↓
Mark sync run as COMPLETED
```

**APPROVED DATA FILTER**:
Every query to PostgreSQL includes:
```sql
WHERE status = 'APPROVED'
AND reviewed_at IS NOT NULL
AND approved_by IS NOT NULL
```

#### **Promotion**:
```
Staging labels (_stg_Drug) → Copy to production (Drug)
    ↓
Update perspectives in Bloom
    ↓
Flip activeVersion pointer
```

### 8. Neo4j Graph Model Example

**Example for Pediatric Oncology**:

**Nodes**:
- `Drug` - FDA-approved drugs
- `Trial` - Clinical trials
- `Decision` - Regulatory decisions
- `Guidance` - FDA/EMA guidance documents
- `Regulator` - Regulatory agencies (FDA, EMA, PMDA)
- `Region` - Geographic regions
- `NewsItem` - Press releases and news
- `Company` - Pharmaceutical companies

**Relationships**:
- `(:Drug)-[:EVALUATED_BY]->(:Regulator)`
- `(:Trial)-[:STUDIES]->(:Drug)`
- `(:Decision)-[:DECIDES_ON]->(:Drug)`
- `(:Decision)-[:FILED_TO]->(:Regulator)`
- `(:Guidance)-[:APPLIES_TO]->(:Drug)`
- `(:NewsItem)-[:ABOUT]->(:Drug)`
- `(:Drug)-[:APPROVED_IN]->(:Region)`

**Properties (Tags for Visualization)**:
- `Decision.type` - "approval", "rejection", "guidance"
- `Region.code` - "US", "EU", "JP", "CA"
- `Drug.pediatricFlag` - true/false
- `*publishedOn` - Date for temporal analysis

### 9. PostgreSQL to Neo4j Mapping

**Curated Views** (read-only, APPROVED ONLY):

**CRITICAL**: All views MUST filter for `status = 'APPROVED'` to ensure only curated, reviewed, and approved content flows into Neo4j.

- `vw_approved_decisions` - Approved regulatory decisions
  ```sql
  WHERE status = 'APPROVED' AND type IN ('APPROVAL', 'GUIDANCE', ...)
  ```
- `vw_approved_trials` - Approved clinical trial records
  ```sql
  WHERE status = 'APPROVED' AND type = 'MEETING'
  ```
- `vw_approved_drugs` - Approved drug information
  ```sql
  WHERE status = 'APPROVED'
  ```
- `vw_approved_guidance` - Approved guidance documents
  ```sql
  WHERE status = 'APPROVED' AND type = 'GUIDANCE'
  ```
- `vw_approved_news` - Approved curated news items
  ```sql
  WHERE status = 'APPROVED' AND type = 'PRESS'
  ```

**Enforcement**:
- All PostgreSQL queries in the sync service MUST include `WHERE status = 'APPROVED'`
- The GraphSyncService validates this filter is present before execution
- QA queries check for any non-approved records in Neo4j (should be zero)

**Mapping Example**:
```typescript
{
  "vw_approved_decisions": {
    "node": "Decision",
    "key": {
      "strategy": "column",
      "fields": ["decision_id"]
    },
    "properties": {
      "type": { "source": "decision_type", "transform": "enum_map" },
      "date": { "source": "decision_date", "transform": "to_date" },
      "pediatricFlag": { "source": "pediatric_flag", "type": "boolean" }
    },
    "relationships": [
      {
        "type": "DECIDES_ON",
        "to": { "label": "Drug", "match": "drug_id" }
      },
      {
        "type": "FILED_TO",
        "to": { "label": "Regulator", "match": "regulator_code" }
      }
    ]
  }
}
```

### 10. Cypher Templates

**Node Template** (MERGE-only):
```cypher
MERGE (n:_stg_Decision {decisionId: $decisionId})
ON CREATE SET
  n.type = $type,
  n.date = date($date),
  n.pediatricFlag = $pediatricFlag,
  n.configVersion = $configVersion,
  n.syncedAt = datetime()
SET
  n.updatedAt = datetime()
RETURN n
```

**Relationship Template**:
```cypher
MATCH (from:_stg_Decision {decisionId: $fromId})
MATCH (to:_stg_Drug {drugId: $toId})
MERGE (from)-[r:DECIDES_ON]->(to)
ON CREATE SET
  r.configVersion = $configVersion,
  r.syncedAt = datetime()
RETURN r
```

### 11. Bloom & NeoDash Integration

#### **Bloom Perspective Defaults**:
```json
{
  "captions": {
    "Drug": "name",
    "Decision": "type",
    "Trial": "title"
  },
  "colors": {
    "Drug": "#3B82F6",
    "Decision": "#10B981",
    "Trial": "#F59E0B"
  },
  "sizes": {
    "by": "degree",
    "range": [10, 50]
  }
}
```

#### **Natural Language Searches**:
- "Show all pediatric oncology drugs approved in the US"
- "Find trials studying Drug X"
- "What decisions were made in 2024?"
- "Show FDA guidance related to pediatric populations"

#### **NeoDash Starter Cards**:
1. **Graph Neighborhood** - Interactive node exploration
2. **News Feed Table** - Recent news items
3. **Monthly Approvals KPI** - Count by month
4. **Region Split** - Pie chart by region
5. **Trial Timeline** - Gantt chart of trials
6. **Drug Network** - Force-directed layout

### 12. QA Validation Queries

**Read-only safety checks**:

```cypher
// 0. ✅ CRITICAL: Verify ONLY approved data in Neo4j
MATCH (n)
WHERE n.approvalStatus IS NOT NULL
  AND n.approvalStatus <> 'APPROVED'
RETURN labels(n), count(*) as non_approved_count
// Expected result: 0 records (should be empty)

// 1. Find orphan relationships (missing endpoint)
MATCH (n)-[r]->(m)
WHERE m IS NULL
RETURN type(r), count(*) as orphan_count

// 2. Find nodes missing required properties
MATCH (n:Drug)
WHERE n.name IS NULL OR n.drugId IS NULL
RETURN n.drugId, labels(n)

// 3. Detect duplicate keys
MATCH (n:Drug)
WITH n.drugId as key, collect(n) as nodes
WHERE size(nodes) > 1
RETURN key, size(nodes) as duplicate_count

// 4. Check enum value drift
MATCH (n:Decision)
WHERE NOT n.type IN ['approval', 'rejection', 'guidance']
RETURN DISTINCT n.type

// 5. Find stale data (not synced recently)
MATCH (n)
WHERE n.syncedAt < datetime() - duration('P7D')
RETURN labels(n), count(*) as stale_count

// 6. Validate relationship consistency
MATCH (d:Decision)-[:DECIDES_ON]->(drug:Drug)
WHERE NOT EXISTS((d)-[:FILED_TO]->(:Regulator))
RETURN d.decisionId, drug.name

// 7. Verify all nodes have approval metadata
MATCH (n)
WHERE n.approvalStatus IS NULL
   OR n.approvedBy IS NULL
   OR n.approvedAt IS NULL
RETURN labels(n), count(*) as missing_approval_metadata
// Expected result: 0 records
```

**APPROVED DATA VALIDATION**:
- Query #0 runs first and MUST return 0 records
- Query #7 ensures all nodes have approval metadata
- If either fails, the sync is considered invalid

### 13. Deployment Checklist

**Before Going Live**:
- [ ] Neo4j running and healthy
- [ ] Database migrations applied (Prisma)
- [ ] PostgreSQL curated views created
- [ ] OpenAI API key configured
- [ ] RBAC roles assigned
- [ ] Staging environment tested
- [ ] Dry run validated with real data
- [ ] QA queries passing
- [ ] Audit logging enabled
- [ ] Bloom perspectives configured
- [ ] NeoDash dashboards created
- [ ] User documentation written

### 14. Implementation Phases

**Phase 1: Foundation** (Days 1-2)
- ✅ Database schema (Prisma models)
- ✅ Neo4j Docker setup
- [ ] Neo4j connection service
- [ ] Basic API endpoints

**Phase 2: AI Proposal Generation** (Days 3-4)
- [ ] GraphProposalService
- [ ] OpenAI integration
- [ ] Template generation
- [ ] Proposal API endpoint

**Phase 3: Dry Run & Sync** (Days 5-7)
- [ ] GraphSyncService
- [ ] Dry run logic
- [ ] Backfill implementation
- [ ] Checkpoint/resume logic

**Phase 4: Admin UI** (Days 8-10)
- [ ] Configuration wizard
- [ ] Proposal viewer
- [ ] Dry run diff viewer
- [ ] Sync progress monitor

**Phase 5: QA & Security** (Days 11-12)
- [ ] Validation queries
- [ ] RBAC implementation
- [ ] Audit logging
- [ ] Error handling

**Phase 6: Visualization** (Days 13-14)
- [ ] Bloom perspectives
- [ ] NeoDash dashboards
- [ ] User documentation
- [ ] Testing and refinement

### 15. Success Criteria

✅ **Admin can describe analytical needs in plain English**
✅ **System generates appropriate graph model automatically**
✅ **Dry run produces diff with zero writes**
✅ **Backfill runs only after explicit approval**
✅ **All writes are MERGE-only (no deletes)**
✅ **✅ ONLY APPROVED DATA syncs to Neo4j (status = 'APPROVED')**
✅ **QA query #0 always returns 0 non-approved records**
✅ **All nodes have approval metadata (approvedBy, approvedAt)**
✅ **Existing ingestion/curation remains untouched**
✅ **Promotion flips perspectives without data loss**
✅ **QA queries validate data integrity**
✅ **Audit log is immutable and complete**
✅ **Bloom/NeoDash visualizations work out of the box**

## Next Steps

Ready to proceed? Let me know if you want to:

1. **Start Phase 1**: Set up Neo4j and create connection services
2. **Review the plan**: Discuss any modifications or priorities
3. **See a working example**: Implement a simplified version first

This is a production-grade system that will take ~14 days to fully implement. We can proceed incrementally, testing each phase before moving to the next.
