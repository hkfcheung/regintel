# Phase 2 Testing Guide

This guide walks through testing the Neo4j Graph Configuration System end-to-end.

## Prerequisites

- ✅ Neo4j running on port 7474/7687
- ✅ PostgreSQL with approved data views
- ✅ API server running on port 3001

## Test 1: Verify PostgreSQL Approved Data

Let's check what approved data we have available:

```bash
psql -U ethancheung -d regintel -c "
SELECT
  'vw_approved_decisions' as view_name, COUNT(*) as count
FROM vw_approved_decisions
UNION ALL
SELECT 'vw_approved_drugs', COUNT(*) FROM vw_approved_drugs
UNION ALL
SELECT 'vw_approved_guidance', COUNT(*) FROM vw_approved_guidance
UNION ALL
SELECT 'vw_approved_news', COUNT(*) FROM vw_approved_news;
"
```

**Expected Result**: Should show counts for each view (we have 14 total approved records).

## Test 2: View Sample Data from PostgreSQL

```bash
psql -U ethancheung -d regintel -c "
SELECT
  drug_id,
  drug_name,
  therapeutic_area,
  approved_date,
  status
FROM vw_approved_drugs
LIMIT 5;
"
```

**Expected Result**: Should show drug records, all with status='APPROVED'.

## Test 3: Generate AI-Powered Graph Proposal

```bash
curl -X POST http://localhost:3001/graph/propose \
  -H "Content-Type: application/json" \
  -d '{
    "profile": "Regulatory intelligence for pediatric oncology",
    "goals": [
      "Track drug approvals",
      "Monitor regulatory guidance",
      "Identify safety alerts"
    ],
    "context": "Focus on FDA and EMA decisions"
  }' | jq '.proposal.nodes[] | {label, keyProperty}'
```

**Expected Result**: AI-generated graph model with node definitions.

## Test 4: Save Configuration

```bash
# First generate proposal and save to file
curl -s -X POST http://localhost:3001/graph/propose \
  -H "Content-Type: application/json" \
  -d '{
    "profile": "Regulatory intelligence for pediatric oncology",
    "goals": ["Track drug approvals", "Monitor guidance"],
    "context": "FDA and EMA focus"
  }' > /tmp/proposal.json

# Extract proposal and create config
jq '{
  name: "Pediatric Oncology Test Config",
  input: {
    profile: "Regulatory intelligence for pediatric oncology",
    goals: ["Track drug approvals"],
    context: "Test configuration"
  },
  proposal: .proposal,
  createdBy: "test_user"
}' /tmp/proposal.json > /tmp/config_request.json

# Save configuration
curl -s -X POST http://localhost:3001/graph/configs \
  -H "Content-Type: application/json" \
  -d @/tmp/config_request.json | jq '.'
```

**Expected Result**: Returns `configId` and `versionId`.

## Test 5: Generate Cypher Templates

```bash
# Extract IDs from previous step
CONFIG_ID=$(cat /tmp/config_ids.txt | head -1)
VERSION_ID=$(cat /tmp/config_ids.txt | tail -1)

# Generate templates
curl -s -X POST "http://localhost:3001/graph/configs/$CONFIG_ID/versions/$VERSION_ID/templates?environment=STAGING" | jq '.templates.nodes | keys'
```

**Expected Result**: List of node labels with generated Cypher templates.

## Test 6: View Generated Cypher Template

```bash
curl -s -X POST "http://localhost:3001/graph/configs/$CONFIG_ID/versions/$VERSION_ID/templates?environment=STAGING" | jq '.templates.nodes.Drug.cypher' -r
```

**Expected Result**: Should show a MERGE query with:
- ✅ `_stg_Drug` label (staging prefix)
- ✅ Key property in MERGE clause
- ✅ `approvalStatus = 'APPROVED'`
- ✅ `approvedBy` and `approvedAt` fields
- ✅ `ON CREATE SET` and `ON MATCH SET` clauses

## Test 7: Manually Execute Template with Real Data

Let's manually test executing a template with real PostgreSQL data:

```bash
# Get a sample drug from PostgreSQL
psql -U ethancheung -d regintel -c "
SELECT
  drug_id,
  drug_name,
  therapeutic_area,
  approved_date::text,
  approved_by,
  approved_at::text
FROM vw_approved_drugs
LIMIT 1;
" -t -A -F "|"
```

Now execute the Cypher template manually in Neo4j Browser:

```cypher
// Copy the template output from Test 6 and replace parameters with actual values
MERGE (n:_stg_Drug {name: 'PembrolizumabOrSimilar'})
ON CREATE SET
  n.name = 'PembrolizumabOrSimilar',
  n.therapeuticArea = 'Pediatric Oncology',
  n.approvedDate = date('2024-01-15'),
  n.approvalStatus = 'APPROVED',
  n.approvedBy = 'system',
  n.approvedAt = datetime('2024-01-15T00:00:00Z'),
  n.configVersion = 'test_v1',
  n.syncedAt = datetime()
ON MATCH SET
  n.updatedAt = datetime(),
  n.lastSyncedAt = datetime()
RETURN n
```

**Expected Result**: Creates or updates a drug node in Neo4j.

## Test 8: Verify Data in Neo4j

Run these queries in Neo4j Browser:

```cypher
// Count all staging nodes
MATCH (n)
WHERE labels(n)[0] STARTS WITH '_stg_'
RETURN labels(n) as label, count(*) as count

// View all drug nodes
MATCH (n:_stg_Drug)
RETURN n
LIMIT 10

// Verify approval metadata
MATCH (n:_stg_Drug)
RETURN
  n.name,
  n.approvalStatus,
  n.approvedBy,
  n.approvedAt,
  n.syncedAt
```

**Expected Result**: Should show staging drug nodes with all approval metadata.

## Test 9: Run QA Validation

```bash
curl -s "http://localhost:3001/graph/qa?environment=STAGING" | jq '.criticalChecks'
```

**Expected Result**:
```json
{
  "approvedDataOnly": "✅ PASSED - All data is APPROVED",
  "approvalMetadata": "✅ PASSED - All nodes have approval metadata"
}
```

## Test 10: Check Database Statistics

```bash
curl -s "http://localhost:3001/graph/stats?environment=STAGING" | jq '.'
```

**Expected Result**: Shows node and relationship counts.

## Test 11: List All Configurations

```bash
curl -s http://localhost:3001/graph/configs | jq '.configs[] | {name, status, createdAt}'
```

**Expected Result**: List of all graph configurations.

## Test 12: Get Configuration Details

```bash
curl -s "http://localhost:3001/graph/configs/$CONFIG_ID" | jq '{
  name: .config.name,
  status: .config.status,
  versionCount: (.config.versions | length),
  syncRunCount: (.config.syncRuns | length)
}'
```

**Expected Result**: Full configuration details with versions and sync runs.

## Summary of What Works

✅ **AI Proposal Generation**: Generates complete graph models from plain English
✅ **Configuration Management**: Save and retrieve graph configurations
✅ **Cypher Template Generation**: Automatically generates MERGE templates
✅ **PostgreSQL Views**: 5 curated views with APPROVED data only
✅ **Approval Metadata**: All templates include approval tracking
✅ **QA Validation**: Automated checks for data integrity
✅ **Staging/Production Separation**: Label prefixes for safe testing

## What's Missing (for Phase 3)

⏳ **Backfill Service**: Automated sync from PostgreSQL to Neo4j
⏳ **Dry-Run Engine**: Preview sync operations without writes
⏳ **Incremental Sync**: Sync only new/updated records
⏳ **Admin UI**: Web interface for configuration management

## Next Steps

After manual testing, we can proceed with:
1. Building the Backfill & Sync Service
2. Implementing Dry-Run preview
3. Creating the Admin UI

---

**Test Status**: Ready for manual testing ✅
