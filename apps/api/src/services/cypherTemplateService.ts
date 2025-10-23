import type {
  GraphNode,
  GraphRelationship,
  MappingRule,
} from "./graphProposalService.js";

/**
 * Cypher Template Service
 *
 * Generates parameterized Cypher MERGE templates from graph models.
 * Handles staging vs production label prefixes and approval metadata.
 *
 * CRITICAL: All nodes include approval metadata (approvalStatus, approvedBy, approvedAt)
 */

export interface NodeTemplate {
  label: string;
  cypher: string;
  parameters: string[]; // List of parameter names expected
}

export interface RelationshipTemplate {
  type: string;
  fromLabel: string;
  toLabel: string;
  cypher: string;
  parameters: string[]; // List of parameter names expected
}

export interface CypherTemplates {
  nodes: Record<string, NodeTemplate>; // Keyed by node label
  relationships: Record<string, RelationshipTemplate>; // Keyed by relationship type
}

/**
 * Generate Cypher templates from a graph model
 *
 * @param nodes - Node definitions from graph model
 * @param relationships - Relationship definitions from graph model
 * @param mappingRules - PostgreSQL to Neo4j mapping rules
 * @param environment - Target environment (STAGING or PRODUCTION)
 * @returns Cypher templates for nodes and relationships
 */
export function generateCypherTemplates(
  nodes: GraphNode[],
  relationships: GraphRelationship[],
  mappingRules: MappingRule[],
  environment: "STAGING" | "PRODUCTION" = "STAGING"
): CypherTemplates {
  const labelPrefix = environment === "STAGING" ? "_stg_" : "";

  const nodeTemplates: Record<string, NodeTemplate> = {};
  const relationshipTemplates: Record<string, RelationshipTemplate> = {};

  // Generate node templates
  for (const node of nodes) {
    const mappingRule = mappingRules.find((r) => r.nodeLabel === node.label);
    if (!mappingRule) {
      console.warn(`No mapping rule found for node: ${node.label}`);
      continue;
    }

    const template = generateNodeTemplate(node, mappingRule, labelPrefix);
    nodeTemplates[node.label] = template;
  }

  // Generate relationship templates
  for (const rel of relationships) {
    const template = generateRelationshipTemplate(rel, labelPrefix);
    relationshipTemplates[rel.type] = template;
  }

  return {
    nodes: nodeTemplates,
    relationships: relationshipTemplates,
  };
}

/**
 * Generate a MERGE template for a node
 */
function generateNodeTemplate(
  node: GraphNode,
  mappingRule: MappingRule,
  labelPrefix: string
): NodeTemplate {
  const label = `${labelPrefix}${node.label}`;

  // Build the key match clause
  const keyProperties = mappingRule.keyFields.map((field) => {
    const mapping = mappingRule.propertyMappings.find(
      (m) => m.pgColumn === field
    );
    const propName = mapping?.neoProperty || field;
    return `${propName}: $${propName}`;
  });

  // Build the ON CREATE SET clause
  const createSetClauses: string[] = [];
  for (const mapping of mappingRule.propertyMappings) {
    // Skip key properties (already in MERGE)
    if (mappingRule.keyFields.includes(mapping.pgColumn)) {
      continue;
    }
    createSetClauses.push(`  n.${mapping.neoProperty} = $${mapping.neoProperty}`);
  }

  // Add approval metadata (CRITICAL)
  createSetClauses.push(`  n.approvalStatus = 'APPROVED'`);
  createSetClauses.push(`  n.approvedBy = $approvedBy`);
  createSetClauses.push(`  n.approvedAt = datetime($approvedAt)`);
  createSetClauses.push(`  n.configVersion = $configVersion`);
  createSetClauses.push(`  n.syncedAt = datetime()`);

  // Build the ON MATCH SET clause (update timestamp only)
  const updateSetClauses = [
    `  n.updatedAt = datetime()`,
    `  n.lastSyncedAt = datetime()`,
  ];

  // Generate the complete Cypher template
  const cypher = `
MERGE (n:${label} {${keyProperties.join(", ")}})
ON CREATE SET
${createSetClauses.join(",\n")}
ON MATCH SET
${updateSetClauses.join(",\n")}
RETURN n
`.trim();

  // Collect all parameter names
  const parameters = [
    ...mappingRule.propertyMappings.map((m) => m.neoProperty),
    "approvedBy",
    "approvedAt",
    "configVersion",
  ];

  return {
    label: node.label,
    cypher,
    parameters,
  };
}

/**
 * Generate a MERGE template for a relationship
 */
function generateRelationshipTemplate(
  relationship: GraphRelationship,
  labelPrefix: string
): RelationshipTemplate {
  const fromLabel = `${labelPrefix}${relationship.from}`;
  const toLabel = `${labelPrefix}${relationship.to}`;

  // Build the Cypher template
  const cypher = `
MATCH (from:${fromLabel} {$fromKeyProperty: $fromKey})
MATCH (to:${toLabel} {$toKeyProperty: $toKey})
MERGE (from)-[r:${relationship.type}]->(to)
ON CREATE SET
  r.configVersion = $configVersion,
  r.syncedAt = datetime()
ON MATCH SET
  r.updatedAt = datetime()
RETURN r
`.trim();

  // Collect parameter names
  const parameters = [
    "fromKeyProperty",
    "fromKey",
    "toKeyProperty",
    "toKey",
    "configVersion",
  ];

  // Add relationship property parameters if any
  if (relationship.properties && relationship.properties.length > 0) {
    for (const prop of relationship.properties) {
      parameters.push(prop.name);
    }
  }

  return {
    type: relationship.type,
    fromLabel: relationship.from,
    toLabel: relationship.to,
    cypher,
    parameters,
  };
}

/**
 * Render a template with actual parameter values
 *
 * @param template - The Cypher template string
 * @param params - Parameter values
 * @returns Rendered Cypher query
 */
export function renderTemplate(
  template: string,
  params: Record<string, any>
): string {
  let rendered = template;

  // Replace $paramName with actual values
  for (const [key, value] of Object.entries(params)) {
    const regex = new RegExp(`\\$${key}\\b`, "g");

    // Format the value based on type
    let formattedValue: string;
    if (value === null || value === undefined) {
      formattedValue = "null";
    } else if (typeof value === "string") {
      formattedValue = `'${value.replace(/'/g, "\\'")}'`;
    } else if (typeof value === "boolean") {
      formattedValue = value.toString();
    } else if (typeof value === "number") {
      formattedValue = value.toString();
    } else if (value instanceof Date) {
      formattedValue = `datetime('${value.toISOString()}')`;
    } else {
      formattedValue = JSON.stringify(value);
    }

    rendered = rendered.replace(regex, formattedValue);
  }

  return rendered;
}

/**
 * Generate a batch of node creation Cypher statements
 *
 * @param nodeLabel - Node label
 * @param template - Node template
 * @param records - Array of records from PostgreSQL
 * @param configVersion - Configuration version ID
 * @returns Array of Cypher queries
 */
export function generateNodeBatch(
  nodeLabel: string,
  template: NodeTemplate,
  records: Array<Record<string, any>>,
  configVersion: string
): Array<{ query: string; params: Record<string, any> }> {
  const queries: Array<{ query: string; params: Record<string, any> }> = [];

  for (const record of records) {
    const params: Record<string, any> = {
      ...record,
      configVersion,
      approvedBy: record.approved_by || "system",
      approvedAt: record.approved_at || new Date().toISOString(),
    };

    queries.push({
      query: template.cypher,
      params,
    });
  }

  return queries;
}

/**
 * Generate a batch of relationship creation Cypher statements
 *
 * @param relType - Relationship type
 * @param template - Relationship template
 * @param records - Array of records with from/to key information
 * @param configVersion - Configuration version ID
 * @returns Array of Cypher queries
 */
export function generateRelationshipBatch(
  relType: string,
  template: RelationshipTemplate,
  records: Array<{
    fromKey: any;
    toKey: any;
    fromKeyProperty: string;
    toKeyProperty: string;
    [key: string]: any;
  }>,
  configVersion: string
): Array<{ query: string; params: Record<string, any> }> {
  const queries: Array<{ query: string; params: Record<string, any> }> = [];

  for (const record of records) {
    const params: Record<string, any> = {
      fromKeyProperty: record.fromKeyProperty,
      fromKey: record.fromKey,
      toKeyProperty: record.toKeyProperty,
      toKey: record.toKey,
      configVersion,
      ...record, // Include any relationship properties
    };

    queries.push({
      query: template.cypher,
      params,
    });
  }

  return queries;
}

/**
 * Validate that a Cypher template is syntactically correct
 *
 * This is a basic validation - for production, consider using a Cypher parser
 */
export function validateTemplate(template: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for balanced parentheses
  const openParens = (template.match(/\(/g) || []).length;
  const closeParens = (template.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push(`Unbalanced parentheses: ${openParens} open, ${closeParens} close`);
  }

  // Check for balanced braces
  const openBraces = (template.match(/\{/g) || []).length;
  const closeBraces = (template.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push(`Unbalanced braces: ${openBraces} open, ${closeBraces} close`);
  }

  // Check for required clauses in node template
  if (template.includes("MERGE") && template.includes("ON CREATE SET")) {
    // Check for approval metadata
    if (!template.includes("approvalStatus")) {
      errors.push("Missing approvalStatus in ON CREATE SET clause");
    }
    if (!template.includes("approvedBy")) {
      errors.push("Missing approvedBy in ON CREATE SET clause");
    }
    if (!template.includes("approvedAt")) {
      errors.push("Missing approvedAt in ON CREATE SET clause");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Save generated templates to database
 */
export async function saveCypherTemplates(
  versionId: string,
  templates: CypherTemplates
): Promise<void> {
  const { prisma } = await import("@regintel/database");

  await prisma.graphConfigVersion.update({
    where: { id: versionId },
    data: {
      cypherTemplates: templates as any,
    },
  });
}
