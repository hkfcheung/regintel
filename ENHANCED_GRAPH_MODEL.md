# Enhanced Knowledge Graph Model - Analytical Insights

## Current Problems

1. **Agencies are properties, not nodes** → Can't visualize agency activity
2. **No TherapeuticArea nodes** → Can't analyze by disease category
3. **Weak relationships** → Only basic string matching
4. **No Safety Alert differentiation** → Can't track warnings vs press releases
5. **Missing analytical paths** → Can't answer: "What drugs did FDA approve for pediatric oncology?"

## Enhanced Model

### **Node Types (with distinct colors)**

| Node Type | Color | Properties | Purpose |
|-----------|-------|------------|---------|
| **Drug** | Blue `#3B82F6` | name, biomarkers, approvedDate | Core entity |
| **Agency** | Pink `#EC4899` | name, code (FDA/EMA/PMDA), domain | Regulatory authority |
| **TherapeuticArea** | Purple `#8B5CF6` | name, category | Disease classification |
| **Decision** | Green `#10B981` | title, date, type (APPROVAL/GUIDANCE) | Regulatory action |
| **Trial** | Amber `#F59E0B` | title, meetingDate, phase | Clinical study |
| **SafetyAlert** | Red `#EF4444` | title, severity, type | Warning/Recall |
| **NewsItem** | Cyan `#06B6D4` | title, publishedDate, type | Press release |
| **Guidance** | Indigo `#6366F1` | title, issuedDate, category | Regulatory guidance |

### **Relationships (Analytical Pathways)**

```
Drug → APPROVED_BY → Agency
Drug → TREATS → TherapeuticArea
Drug → SUBJECT_OF → Decision
Drug → STUDIED_IN → Trial
Drug → HAS_ALERT → SafetyAlert
Drug → MENTIONED_IN → NewsItem
Decision → ISSUED_BY → Agency
SafetyAlert → ISSUED_BY → Agency
Guidance → ISSUED_BY → Agency
Guidance → APPLIES_TO → TherapeuticArea
```

## Analytical Insights Enabled

### **1. Agency-Drug Relationships**
**Question**: "Which drugs did FDA approve vs EMA?"
```cypher
MATCH (d:Drug)-[:APPROVED_BY]->(a:Agency {code: 'FDA'})
RETURN d.name, d.approvedDate
ORDER BY d.approvedDate DESC
```

### **2. Therapeutic Area Analysis**
**Question**: "What drugs treat Pediatric Oncology?"
```cypher
MATCH (d:Drug)-[:TREATS]->(ta:TherapeuticArea {name: 'Pediatric Oncology'})
RETURN d.name, d.biomarkers
```

### **3. Safety Signal Detection**
**Question**: "Which drugs have safety alerts?"
```cypher
MATCH (d:Drug)-[:HAS_ALERT]->(sa:SafetyAlert)
WHERE sa.severity IN ['High', 'Medium']
RETURN d.name, sa.title, sa.severity, sa.publishedDate
ORDER BY sa.publishedDate DESC
```

### **4. Agency Activity**
**Question**: "How many approvals did each agency issue?"
```cypher
MATCH (a:Agency)<-[:ISSUED_BY]-(dec:Decision {type: 'APPROVAL'})
RETURN a.name, count(dec) as approvals
ORDER BY approvals DESC
```

### **5. Cross-Reference Warnings & Approvals**
**Question**: "Show drugs with both approvals and safety alerts"
```cypher
MATCH (d:Drug)-[:SUBJECT_OF]->(dec:Decision)
MATCH (d)-[:HAS_ALERT]->(sa:SafetyAlert)
RETURN d.name, dec.title as approval, sa.title as alert, sa.severity
```

### **6. Multi-Hop Insights**
**Question**: "Which agencies issued guidance affecting drugs with alerts?"
```cypher
MATCH (a:Agency)<-[:ISSUED_BY]-(g:Guidance)-[:APPLIES_TO]->(ta:TherapeuticArea)
MATCH (d:Drug)-[:TREATS]->(ta)
MATCH (d)-[:HAS_ALERT]->(sa:SafetyAlert)
RETURN a.name, g.title, collect(DISTINCT d.name) as affectedDrugs, count(sa) as alertCount
```

### **7. Timeline Analysis**
**Question**: "Show regulatory activity timeline for a drug"
```cypher
MATCH (d:Drug {name: 'Pembrolizumab'})-[r]-(n)
WHERE n.publishedDate IS NOT NULL OR n.approvedDate IS NOT NULL OR n.issuedDate IS NOT NULL
RETURN
  labels(n)[0] as eventType,
  coalesce(n.title, n.name) as event,
  coalesce(n.publishedDate, n.approvedDate, n.issuedDate) as date
ORDER BY date DESC
```

## Visual Color Legend

When viewing the graph:
- **Blue nodes (Drug)**: The drugs being tracked
- **Pink nodes (Agency)**: FDA, EMA, PMDA
- **Purple nodes (TherapeuticArea)**: Disease categories
- **Red nodes (SafetyAlert)**: Warnings and recalls
- **Green nodes (Decision)**: Approvals and rejections
- **Cyan nodes (NewsItem)**: Press releases
- **Indigo nodes (Guidance)**: Regulatory guidance documents

## Example: Tracing a Drug's Journey

For drug "Pembrolizumab":
1. **Approval**: `(Drug)-[:APPROVED_BY]->(FDA)` - Shows who approved it
2. **Indication**: `(Drug)-[:TREATS]->(Pediatric Oncology)` - What it treats
3. **Evidence**: `(Drug)-[:STUDIED_IN]->(Trial)` - Clinical evidence
4. **Guidance**: `(Guidance)-[:APPLIES_TO]->(Pediatric Oncology)` - Relevant regulations
5. **Safety**: `(Drug)-[:HAS_ALERT]->(SafetyAlert)` - Any warnings
6. **News**: `(Drug)-[:MENTIONED_IN]->(NewsItem)` - Press coverage

This creates a complete regulatory intelligence picture for each drug!
