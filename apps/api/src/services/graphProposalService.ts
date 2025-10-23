import OpenAI from "openai";
import { prisma } from "@regintel/database";

/**
 * Graph Proposal Service
 *
 * Uses AI (OpenAI GPT-4) to generate Neo4j graph models from admin descriptions.
 * Takes natural language input about industry/company/focus and analytical goals,
 * then proposes a complete multidimensional graph model.
 *
 * CRITICAL CONSTRAINT: Only APPROVED source items (status = 'APPROVED') are synced to Neo4j.
 */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ProposalInput {
  profile: string; // Industry/company/focus description
  goals: string[]; // Array of analytical goals
  context?: string; // Optional context (populations, biomarkers, etc.)
  trustedSources?: string[]; // Optional list of trusted source domains
}

export interface GraphNode {
  label: string; // Node label (e.g., "Drug", "Trial", "Decision")
  description: string; // What this node represents
  properties: Array<{
    name: string;
    type: string; // "string", "integer", "float", "boolean", "date", "datetime"
    required: boolean;
    description: string;
  }>;
  keyProperty: string; // Property used as unique identifier
}

export interface GraphRelationship {
  type: string; // Relationship type (e.g., "EVALUATED_BY", "STUDIES")
  from: string; // Source node label
  to: string; // Target node label
  description: string;
  properties?: Array<{
    name: string;
    type: string;
    description: string;
  }>;
}

export interface MappingRule {
  postgresView: string; // Source PostgreSQL view (must filter WHERE status='APPROVED')
  nodeLabel: string; // Target Neo4j node label
  keyStrategy: "column" | "composite" | "hash"; // How to generate unique keys
  keyFields: string[]; // Fields to use for key generation
  propertyMappings: Array<{
    neoProperty: string; // Neo4j property name
    pgColumn: string; // PostgreSQL column name
    transform?: "to_date" | "to_datetime" | "to_upper" | "to_lower" | "enum_map";
    enumMap?: Record<string, string>; // For enum transformations
  }>;
  relationships: Array<{
    type: string; // Relationship type
    toLabel: string; // Target node label
    matchStrategy: "column" | "lookup"; // How to find target node
    matchField: string; // Field to match on
  }>;
}

export interface GraphProposal {
  summary: string[]; // Bullet points summarizing the proposal
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  mappingRules: MappingRule[];
  bloomSuggestions: {
    captions: Record<string, string>; // Node label captions
    colors: Record<string, string>; // Node colors (hex)
    sizes: {
      by: string; // Property to size by (e.g., "degree")
      range: [number, number]; // Min/max sizes
    };
    naturalLanguageExamples: string[]; // Example Bloom searches
  };
  neodashSuggestions: Array<{
    title: string;
    type: "graph" | "table" | "kpi" | "pie" | "bar" | "line";
    query: string; // Cypher query
    description: string;
  }>;
}

/**
 * Generate a graph proposal from admin input
 */
export async function generateGraphProposal(
  input: ProposalInput
): Promise<GraphProposal> {
  const systemPrompt = `You are an expert Neo4j graph database architect specializing in regulatory intelligence and life sciences.

Your task is to design a multidimensional Neo4j graph model based on the user's description of their industry, company focus, and analytical goals.

CRITICAL CONSTRAINTS:
1. **APPROVED DATA ONLY**: All PostgreSQL views MUST filter WHERE status = 'APPROVED' to ensure only curated, reviewed, and approved content flows into Neo4j.
2. **MERGE-ONLY**: All Neo4j writes use MERGE (never DELETE/DROP/DETACH).
3. **Read-Only PostgreSQL**: Never alter existing ingestion/curation/scheduling.
4. **Schema-Agnostic**: Infer structure from admin input, not hardcoded schemas.

POSTGRESQL SOURCE SCHEMA:
The system has a SourceItem table with the following structure:
- id (string, primary key)
- url (string, unique)
- sourceDomain (string)
- type (enum: GUIDANCE, WARNING_LETTER, UNTITLED_LETTER, MEETING, APPROVAL, PRESS)
- title (string)
- publishedAt (datetime)
- status (enum: INTAKE, REVIEW, APPROVED, REJECTED, PUBLISHED)
- tags (JSON array of strings)
- analyses (related Analysis records with summaryMd, impactMd)

CRITICAL: All mapping rules must reference PostgreSQL views that filter:
WHERE status = 'APPROVED' AND reviewed_at IS NOT NULL AND approved_by IS NOT NULL

AVAILABLE POSTGRESQL VIEWS (examples):
- vw_approved_decisions: Approved regulatory decisions (APPROVAL, GUIDANCE types)
- vw_approved_trials: Approved clinical trial records (MEETING type)
- vw_approved_drugs: Approved drug information extracted from analyses
- vw_approved_guidance: Approved guidance documents (GUIDANCE type)
- vw_approved_news: Approved curated news items (PRESS type)

Your response must be a valid JSON object with the following structure:
{
  "summary": ["bullet point 1", "bullet point 2", ...],
  "nodes": [
    {
      "label": "NodeLabel",
      "description": "What this node represents",
      "properties": [
        {
          "name": "propertyName",
          "type": "string|integer|float|boolean|date|datetime",
          "required": true|false,
          "description": "Property description"
        }
      ],
      "keyProperty": "uniqueIdentifierProperty"
    }
  ],
  "relationships": [
    {
      "type": "RELATIONSHIP_TYPE",
      "from": "SourceNodeLabel",
      "to": "TargetNodeLabel",
      "description": "What this relationship represents",
      "properties": []
    }
  ],
  "mappingRules": [
    {
      "postgresView": "vw_approved_decisions",
      "nodeLabel": "Decision",
      "keyStrategy": "column",
      "keyFields": ["id"],
      "propertyMappings": [
        {
          "neoProperty": "decisionId",
          "pgColumn": "id",
          "transform": null
        }
      ],
      "relationships": [
        {
          "type": "DECIDES_ON",
          "toLabel": "Drug",
          "matchStrategy": "column",
          "matchField": "drug_id"
        }
      ]
    }
  ],
  "bloomSuggestions": {
    "captions": {
      "Drug": "name",
      "Decision": "type"
    },
    "colors": {
      "Drug": "#3B82F6",
      "Decision": "#10B981"
    },
    "sizes": {
      "by": "degree",
      "range": [10, 50]
    },
    "naturalLanguageExamples": [
      "Show all pediatric oncology drugs approved in the US",
      "Find trials studying Drug X"
    ]
  },
  "neodashSuggestions": [
    {
      "title": "Recent Approvals",
      "type": "table",
      "query": "MATCH (d:Drug) RETURN d.name, d.approvedDate ORDER BY d.approvedDate DESC LIMIT 10",
      "description": "Latest drug approvals"
    }
  ]
}

Design principles:
1. **Nodes** should represent distinct entities (drugs, trials, decisions, regulators, companies, regions)
2. **Relationships** should capture meaningful connections (EVALUATED_BY, STUDIES, DECIDES_ON, APPROVED_IN)
3. **Properties** should enable filtering and visualization (dates, types, flags, codes)
4. **Mapping rules** must reference APPROVED-only views and specify how to extract data
5. **Bloom suggestions** should enable natural language exploration
6. **NeoDash cards** should provide immediate analytical value

Return ONLY the JSON object, no additional text.`;

  const userPrompt = `Please design a Neo4j graph model for the following use case:

**Profile**: ${input.profile}

**Analytical Goals**:
${input.goals.map((goal, i) => `${i + 1}. ${goal}`).join("\n")}

${input.context ? `**Additional Context**: ${input.context}` : ""}

${
  input.trustedSources && input.trustedSources.length > 0
    ? `**Trusted Sources**: ${input.trustedSources.join(", ")}`
    : ""
}

Design a comprehensive multidimensional graph model that addresses these goals. Remember:
- Only APPROVED data syncs to Neo4j
- All PostgreSQL views must filter WHERE status = 'APPROVED'
- Use MERGE-only operations
- Design for exploration and discovery`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 4000,
    response_format: { type: "json_object" },
  });

  const responseText = completion.choices[0]?.message?.content;
  if (!responseText) {
    throw new Error("OpenAI returned empty response");
  }

  // Parse and validate the JSON response
  const proposal: GraphProposal = JSON.parse(responseText);

  // Validate that all mapping rules reference approved-only views
  for (const rule of proposal.mappingRules) {
    if (!rule.postgresView.includes("approved")) {
      console.warn(
        `⚠️  WARNING: Mapping rule for ${rule.nodeLabel} references non-approved view: ${rule.postgresView}`
      );
    }
  }

  return proposal;
}

/**
 * Save a graph proposal to the database
 */
export async function saveGraphProposal(
  name: string,
  input: ProposalInput,
  proposal: GraphProposal,
  createdBy: string
): Promise<{ configId: string; versionId: string }> {
  // Get current PostgreSQL schema snapshot (for reference)
  const pgSchemaSnapshot = {
    timestamp: new Date().toISOString(),
    note: "Snapshot of PostgreSQL schema at proposal time",
    // In production, you'd query INFORMATION_SCHEMA to capture actual schema
    views: [
      "vw_approved_decisions",
      "vw_approved_trials",
      "vw_approved_drugs",
      "vw_approved_guidance",
      "vw_approved_news",
    ],
  };

  // Create graph configuration
  const config = await prisma.graphConfig.create({
    data: {
      name,
      profile: input.profile,
      goals: input.goals,
      context: input.context || null,
      trustedSources: input.trustedSources || [],
      pgSchemaSnapshot,
      constraints: {
        approvedDataOnly: true,
        mergeOnlyWrites: true,
        readOnlyPostgres: true,
      },
      status: "PROPOSED",
      createdBy,
    },
  });

  // Create first version with the proposal
  const version = await prisma.graphConfigVersion.create({
    data: {
      configId: config.id,
      version: 1,
      summary: proposal.summary as any,
      graphModel: {
        nodes: proposal.nodes,
        relationships: proposal.relationships,
      } as any,
      pgToGraphMapping: {
        rules: proposal.mappingRules,
      } as any,
      cypherTemplates: {}, // Will be generated in next step
      bloomSuggestions: proposal.bloomSuggestions as any,
      neodashSuggestions: proposal.neodashSuggestions as any,
      qaQueries: [
        {
          name: "Query #0: Verify APPROVED data only",
          query: `MATCH (n) WHERE n.approvalStatus IS NOT NULL AND n.approvalStatus <> 'APPROVED' RETURN count(*) as nonApprovedCount`,
          critical: true,
          expectedResult: "0 records",
        },
        {
          name: "Query #7: Verify approval metadata",
          query: `MATCH (n) WHERE n.approvalStatus IS NULL OR n.approvedBy IS NULL OR n.approvedAt IS NULL RETURN count(*) as missingMetadata`,
          critical: true,
          expectedResult: "0 records",
        },
      ],
    },
  });

  // Create audit log entry
  await prisma.graphAudit.create({
    data: {
      configId: config.id,
      versionId: version.id,
      action: "config.proposed",
      actor: createdBy,
      metadata: {
        proposalGeneration: {
          model: "gpt-4o",
          timestamp: new Date().toISOString(),
          nodeCount: proposal.nodes.length,
          relationshipCount: proposal.relationships.length,
        },
      },
    },
  });

  return {
    configId: config.id,
    versionId: version.id,
  };
}
