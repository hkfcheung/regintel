# Knowledge Graph - Analytical Insights Guide

## ✅ Enhanced Graph Now Live!

Your knowledge graph now contains **25 nodes** with **44 rich relationships** from your **15 approved documents**.

### **What Changed**

| Before | After | Improvement |
|--------|-------|-------------|
| 21 nodes | **25 nodes** | +4 nodes (Agency + SafetyAlerts) |
| 16 relationships | **44 relationships** | **+175%** more connections |
| 3 node types | **9 node types** | Agencies, SafetyAlerts separated |
| Basic string matching | **Multi-hop analytical paths** | Deep insights enabled |

---

## 📊 Your Current Graph Composition

### **Nodes by Type** (Color-Coded)

| Type | Count | Color | What It Represents |
|------|-------|-------|-------------------|
| **Drug** | 5 | 🔵 Blue | Approved pharmaceutical products |
| **Agency** | 1 | 💗 Pink | FDA (regulatory authority) |
| **Decision** | 4 | 💚 Green | Approval/rejection decisions |
| **SafetyAlert** | 3 | 🔴 Red | Safety warnings, recalls |
| **NewsItem** | 5 | 🐬 Cyan | Press releases |
| **Guidance** | 1 | 💙 Indigo | Regulatory guidance documents |
| **Trial** | 0 | 🟡 Amber | Clinical trials (when data available) |

### **Relationships Created**

| Relationship Type | Count | Connects | Purpose |
|-------------------|-------|----------|---------|
| **APPROVED_BY** | ✅ | Drug → Agency | "Which agency approved this drug?" |
| **SUBJECT_OF** | ✅ | Drug → Decision | "What decisions were made about this drug?" |
| **ISSUED_BY** | ✅ | Decision/Guidance → Agency | "Who issued this decision?" |
| **HAS_ALERT** | ✅ | Drug → SafetyAlert | "What safety concerns exist for this drug?" |
| **MENTIONED_IN** | ✅ | Drug → NewsItem | "What news mentions this drug?" |
| **STUDIES** | ✅ | Trial → Drug | "Which trials studied this drug?" |

---

## 🔍 Analytical Questions You Can Now Answer

### **1. Which Drugs Did FDA Approve?**

**Visual**: Look for **blue Drug nodes** connected to the **pink FDA node** via pink arrows labeled "APPROVED_BY"

**Insight**: Trace the approval pathway from drug to regulatory authority

---

### **2. Which Drugs Have Safety Alerts?**

**Visual**: Find **red SafetyAlert nodes** connected to blue Drug nodes

**Insight**: Identify drugs with post-approval safety concerns

**Example Path**:
```
[Drug] --HAS_ALERT--> [SafetyAlert {severity: "High"}]
```

---

### **3. Agency Activity Analysis**

**Visual**: The **pink FDA node** shows all its outgoing "ISSUED_BY" relationships

**Count**: How many decisions, guidance documents, and alerts did FDA issue?

**Insight**: Understand regulatory agency workload and focus areas

---

### **4. Complete Drug Intelligence Profile**

For any drug (e.g., "Oncology"):

1. **Approval**: `[Drug] --APPROVED_BY--> [FDA]`
2. **Decisions**: `[Drug] --SUBJECT_OF--> [Decision]`
3. **Safety**: `[Drug] --HAS_ALERT--> [SafetyAlert]`
4. **News Coverage**: `[Drug] --MENTIONED_IN--> [NewsItem]`
5. **Clinical Evidence**: `[Drug] <--STUDIES-- [Trial]`

**Visual**: Click the drug node to see all connected nodes in the detail panel

---

### **5. Cross-Reference Approvals & Warnings**

**Question**: "Show me drugs that have both FDA approval AND safety alerts"

**Visual Path**:
```
[Drug] --APPROVED_BY--> [FDA]
  ↓ also has
[Drug] --HAS_ALERT--> [SafetyAlert]
```

**Insight**: Identify drugs requiring extra vigilance despite approval

---

### **6. Decision Timeline Analysis**

**Visual**: Decisions are color-coded by type (APPROVAL vs GUIDANCE)

**Temporal Query**: "When did FDA make the most decisions?"

**Properties Available**:
- `decisionDate`
- `type` (APPROVAL, GUIDANCE, etc.)
- `title`
- `url` (link back to source document)

---

### **7. Multi-Agency Comparison** (When You Have EMA Data)

Future capability once you ingest EMA documents:

```
[Drug] --APPROVED_BY--> [FDA] (blue drug → pink FDA)
[Drug] --APPROVED_BY--> [EMA] (blue drug → pink EMA)
```

**Insight**: Which drugs are approved in multiple regions?

---

## 🎨 Visual Guide - What You See

### **In the Graph Viewer** (http://localhost:3000/graph)

1. **Blue circular nodes** = Drugs (your core entities)
2. **Pink circular nodes** = Agencies (FDA, EMA, PMDA)
3. **Red circular nodes** = Safety Alerts (warnings, recalls)
4. **Green circular nodes** = Decisions (approvals, rejections)
5. **Cyan circular nodes** = News (press releases)
6. **Indigo circular nodes** = Guidance (regulatory documents)

### **Arrows/Links**

- **Arrows point from source to target**
- **Hover over an arrow** to see the relationship type
- **Relationship labels** appear on the arrows (APPROVED_BY, HAS_ALERT, etc.)

### **Node Details Panel**

Click any node to see:
- **Name/Title**
- **Type** (Drug, Agency, etc.)
- **All properties** (URL, dates, severity, agency, etc.)
- **Approval metadata** (who approved, when, status)

---

## 💡 Example Use Cases

### **Regulatory Compliance**

**Task**: "Find all FDA decisions in the last 6 months"

**Path**: Filter Decision nodes by `decisionDate` and `ISSUED_BY → FDA`

---

### **Safety Surveillance**

**Task**: "Monitor drugs with high-severity alerts"

**Path**: Find Drug nodes with `HAS_ALERT` relationships where `severity = 'High'`

---

### **Competitive Intelligence**

**Task**: "Track FDA approval activity for oncology drugs"

**Path**:
```
[Drug {therapeuticArea: 'Oncology'}] --APPROVED_BY--> [FDA]
```

---

### **Regulatory Trend Analysis**

**Task**: "How many approvals did FDA issue this month vs last month?"

**Path**: Count Decision nodes by type and date, grouped by month

---

## 🔗 Relationship Semantics

| Relationship | Direction | Meaning | Reciprocal |
|-------------|-----------|---------|-----------|
| APPROVED_BY | Drug → Agency | "Pembrolizumab was approved by FDA" | - |
| SUBJECT_OF | Drug → Decision | "Decision XYZ pertains to this drug" | - |
| ISSUED_BY | Decision/Alert → Agency | "FDA issued this decision" | - |
| HAS_ALERT | Drug → SafetyAlert | "This drug has a safety concern" | - |
| MENTIONED_IN | Drug → NewsItem | "This drug was mentioned in press release" | - |
| STUDIES | Trial → Drug | "This trial studied the drug" | - |

---

## 📈 Growth Potential

As you approve more documents in PostgreSQL, the graph will automatically:

1. **Add new drugs** (blue nodes)
2. **Connect to existing agencies** (pink nodes)
3. **Link related decisions** (green nodes)
4. **Flag new safety alerts** (red nodes)
5. **Capture news mentions** (cyan nodes)

Each approved document enriches the graph's analytical power!

---

## 🎯 Next Steps to Extract More Insights

### **1. Export Graph Queries**

Once you identify useful patterns, save them as reusable queries in Neo4j Browser (localhost:7474).

### **2. Time-Series Analysis**

Track trends:
- Approvals per month
- Alerts per quarter
- Agency activity over time

### **3. Network Analysis**

Use Neo4j Graph Data Science algorithms:
- **PageRank**: Which drugs are most "central" in the network?
- **Community Detection**: Which drugs cluster together?
- **Shortest Path**: What's the regulatory path from trial to approval?

### **4. Predictive Insights**

With enough data:
- "Drugs with similar profiles to those that received alerts"
- "Typical time from trial to approval for pediatric oncology"

---

## ✨ Key Takeaway

Your knowledge graph is no longer just flat data - it's a **living network of regulatory intelligence** where:

- **Every drug** connects to its regulatory journey
- **Every agency** shows its activity pattern
- **Every safety alert** links back to affected drugs
- **Every relationship** reveals an analytical insight

**Open the graph at http://localhost:3000/graph and explore!**
