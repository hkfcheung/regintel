# ✅ Neo4j Graph: APPROVED DATA ONLY

## Critical Constraint

**ONLY source items with `status = 'APPROVED'` are synchronized to Neo4j.**

This ensures that the graph database contains only curated, reviewed, and approved regulatory intelligence—no draft, pending, or rejected content.

## Enforcement at Every Layer

### 1. **PostgreSQL Views** (Source)

All views used for Neo4j sync MUST include:
```sql
WHERE status = 'APPROVED'
  AND reviewed_at IS NOT NULL
  AND approved_by IS NOT NULL
```

**Example Views**:
- `vw_approved_decisions`
- `vw_approved_trials`
- `vw_approved_drugs`
- `vw_approved_guidance`
- `vw_approved_news`

### 2. **GraphSyncService** (Application Layer)

Every query to PostgreSQL includes validation:
```typescript
const APPROVED_FILTER = `
  WHERE s.status = 'APPROVED'
  AND s.reviewed_at IS NOT NULL
  AND s.approved_by IS NOT NULL
`;

// All queries automatically append this filter
const query = `
  SELECT * FROM source_items s
  ${APPROVED_FILTER}
  ORDER BY s.id
  LIMIT ${batchSize}
`;
```

### 3. **Neo4j Node Properties** (Data Layer)

Every node stores approval metadata:
```cypher
MERGE (n:Drug {drugId: $drugId})
ON CREATE SET
  n.approvalStatus = 'APPROVED',
  n.approvedBy = $approvedBy,
  n.approvedAt = datetime($approvedAt),
  n.reviewedAt = datetime($reviewedAt)
```

### 4. **QA Validation** (Verification Layer)

**Query #0** - Run on every sync to verify compliance:
```cypher
// MUST return 0 records
MATCH (n)
WHERE n.approvalStatus IS NOT NULL
  AND n.approvalStatus <> 'APPROVED'
RETURN labels(n), count(*) as non_approved_count
```

**Query #7** - Verify all nodes have approval metadata:
```cypher
// MUST return 0 records
MATCH (n)
WHERE n.approvalStatus IS NULL
   OR n.approvedBy IS NULL
   OR n.approvedAt IS NULL
RETURN labels(n), count(*) as missing_approval_metadata
```

## Why This Matters

### For Data Quality
- ✅ **Trustworthy**: Only vetted content in the graph
- ✅ **Consistent**: All data passed the same review process
- ✅ **Traceable**: Every node has approval metadata

### For Compliance
- ✅ **Auditable**: Clear approval chain
- ✅ **Defensible**: All decisions documented
- ✅ **Regulated**: Meets industry standards

### For Users
- ✅ **Reliable**: No draft or rejected content
- ✅ **Professional**: Production-ready visualizations
- ✅ **Confident**: Can trust graph insights

## Status Flow

```
                PostgreSQL (Source)                     Neo4j (Graph)
┌────────────────────────────────────┐          ┌────────────────────┐
│ INTAKE (new items)                 │          │                    │
│    ↓                               │          │                    │
│ REVIEW (under evaluation)          │   ❌     │   (not synced)     │
│    ↓                               │          │                    │
│ ✅ APPROVED (passed review) ───────┼─────────→│  ✅ Synced to Neo4j│
│                                    │          │                    │
│ ❌ REJECTED (failed review)        │   ❌     │   (not synced)     │
│                                    │          │                    │
│ PUBLISHED (bulletin sent)          │   ✅     │  ✅ Already in Neo4j│
└────────────────────────────────────┘          └────────────────────┘
```

## Examples

### ✅ What Syncs to Neo4j

**Approved Drug Approval**:
```json
{
  "id": "item_123",
  "status": "APPROVED",
  "type": "APPROVAL",
  "title": "FDA approves pembrolizumab for pediatric melanoma",
  "approved_by": "user_456",
  "approved_at": "2025-01-15T10:00:00Z",
  "reviewed_at": "2025-01-15T09:30:00Z"
}
```
→ **Syncs to Neo4j** as `(:Drug)-[:APPROVED_BY]->(:Regulator)`

**Approved Guidance**:
```json
{
  "id": "item_789",
  "status": "APPROVED",
  "type": "GUIDANCE",
  "title": "FDA guidance on pediatric clinical trials",
  "approved_by": "user_456",
  "approved_at": "2025-01-20T14:00:00Z"
}
```
→ **Syncs to Neo4j** as `(:Guidance)-[:APPLIES_TO]->(:Drug)`

### ❌ What Does NOT Sync

**Draft Item**:
```json
{
  "id": "item_999",
  "status": "INTAKE",  ← Not approved yet
  "type": "APPROVAL",
  "title": "FDA approves...",
  "approved_by": null,
  "approved_at": null
}
```
→ **❌ NOT synced** (still in intake)

**Rejected Item**:
```json
{
  "id": "item_888",
  "status": "REJECTED",  ← Explicitly rejected
  "type": "PRESS",
  "title": "Company announces...",
  "reviewed_by": "user_456",
  "rejected_at": "2025-01-10T12:00:00Z",
  "rejection_reason": "Out of scope"
}
```
→ **❌ NOT synced** (rejected content)

**Under Review**:
```json
{
  "id": "item_777",
  "status": "REVIEW",  ← Still being reviewed
  "type": "MEETING",
  "title": "FDA advisory committee meeting",
  "reviewer": "user_789"
}
```
→ **❌ NOT synced** (review pending)

## Implementation Checklist

When implementing any Neo4j sync feature:

- [ ] ✅ PostgreSQL query includes `WHERE status = 'APPROVED'`
- [ ] ✅ Service layer validates approved filter is present
- [ ] ✅ Neo4j nodes include `approvalStatus`, `approvedBy`, `approvedAt`
- [ ] ✅ QA query #0 runs and returns 0 non-approved records
- [ ] ✅ QA query #7 verifies all nodes have approval metadata
- [ ] ✅ Unit tests verify only approved data is synced
- [ ] ✅ Integration tests validate the full flow
- [ ] ✅ Documentation clearly states "APPROVED ONLY"

## Monitoring & Alerts

**Daily Checks**:
1. Run QA query #0 → Alert if > 0 records
2. Run QA query #7 → Alert if > 0 records
3. Compare counts: `SELECT COUNT(*) FROM source_items WHERE status='APPROVED'` vs Neo4j node count

**Alerts**:
- 🚨 **CRITICAL**: Non-approved data found in Neo4j
- ⚠️ **WARNING**: Approval metadata missing on nodes
- ℹ️ **INFO**: Sync completed with X approved records

## FAQs

**Q: What if an approved item is later rejected?**
A: The item status changes to REJECTED in PostgreSQL, but it remains in Neo4j. We never delete from Neo4j (MERGE-only). Future syncs won't update it since it's no longer APPROVED.

**Q: Can we sync draft items for testing?**
A: Only in a separate staging environment with clear labels (e.g., `_draft_Drug`). Production Neo4j must only contain APPROVED data.

**Q: What about incremental syncs?**
A: Incremental syncs also filter:
```sql
WHERE status = 'APPROVED'
  AND updated_at > $last_synced_at
```

**Q: How do we know if a sync violated this rule?**
A: QA query #0 runs after every sync. If it returns > 0 records, the sync is marked as FAILED and an alert is triggered.

## Summary

✅ **APPROVED DATA ONLY** is a foundational principle of the Neo4j graph system.

Every layer—from PostgreSQL views to QA queries—enforces this constraint to ensure the graph contains only high-quality, vetted regulatory intelligence.

**No exceptions. No draft data. No rejected content. APPROVED ONLY.**
