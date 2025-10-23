/**
 * LLM Chat Service
 * Handles chat interactions with graph and PostgreSQL databases using configured LLMs
 */

import { prisma } from "@regintel/database";
import { ollamaService } from "./ollamaService.js";
import { neo4jService } from "./neo4jService.js";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message: string;
  context?: "graph" | "postgres" | "both";
  history?: ChatMessage[];
}

interface ChatResponse {
  answer: string;
  queries?: {
    cypher?: string;
    sql?: string;
  };
  results?: {
    graph?: any;
    postgres?: any;
  };
}

const GRAPH_SYSTEM_PROMPT = `You are a helpful assistant that helps users query a Neo4j graph database containing regulatory intelligence data.

The graph contains:
- Drug nodes with properties: name, type, mechanism
- Disease nodes with properties: name, category
- Trial nodes with properties: nctId, phase, status, title
- Relationships: TREATS, TESTED_IN, TARGETS

When a user asks a question, generate a Cypher query to answer it. If the question can't be answered with the graph data, say so politely.

Respond in this format:
CYPHER:
<your cypher query here>

EXPLANATION:
<brief explanation of what the query does>`;

const POSTGRES_SYSTEM_PROMPT = `You are a helpful assistant that helps users query a PostgreSQL database containing regulatory intelligence data.

The database contains tables:
- source_items: Regulatory documents with title, publishedAt, sourceDomain, type, status
- analyses: AI-generated summaries and impact analyses of documents
- reviews: Review decisions by human reviewers
- rss_feeds: RSS feed configurations
- allowed_domains: Configured regulatory domains

When a user asks a question, generate a SQL query to answer it. Use PostgreSQL syntax. If the question can't be answered with the database data, say so politely.

Respond in this format:
SQL:
<your SQL query here>

EXPLANATION:
<brief explanation of what the query does>`;

const COMBINED_SYSTEM_PROMPT = `You are a helpful assistant that helps users query both a Neo4j graph database and a PostgreSQL relational database containing regulatory intelligence data.

Graph database (Neo4j) contains:
- Drug, Disease, and Trial nodes with relationships
- Good for exploring connections and relationships

Relational database (PostgreSQL) contains:
- source_items: Regulatory documents
- analyses: AI-generated summaries
- reviews: Human review decisions
- Good for structured queries and aggregations

When a user asks a question, determine which database(s) to query and generate appropriate Cypher and/or SQL queries.

Respond in this format:
CYPHER: (if needed)
<your cypher query here>

SQL: (if needed)
<your SQL query here>

EXPLANATION:
<brief explanation of your approach>`;

export class LlmChatService {
  /**
   * Get the default or specified LLM configuration
   */
  private async getLlmConfig(configId?: string) {
    if (configId) {
      return await prisma.llmConfig.findUnique({
        where: { id: configId },
      });
    }

    // Get default config
    return await prisma.llmConfig.findFirst({
      where: { active: true, isDefault: true },
    });
  }

  /**
   * Execute a chat request
   */
  async chat(request: ChatRequest, llmConfigId?: string): Promise<ChatResponse> {
    const llmConfig = await this.getLlmConfig(llmConfigId);

    if (!llmConfig) {
      throw new Error("No active LLM configuration found");
    }

    // Build system prompt based on context
    let systemPrompt = COMBINED_SYSTEM_PROMPT;
    if (request.context === "graph") {
      systemPrompt = GRAPH_SYSTEM_PROMPT;
    } else if (request.context === "postgres") {
      systemPrompt = POSTGRES_SYSTEM_PROMPT;
    }

    // Build messages array
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...(request.history || []),
      { role: "user", content: request.message },
    ];

    // Get LLM response
    let llmResponse: string;

    if (llmConfig.provider === "OLLAMA") {
      const baseUrl = llmConfig.baseUrl || "http://localhost:11434";
      const ollama = new (await import("./ollamaService.js")).OllamaService(baseUrl);

      llmResponse = await ollama.chat(llmConfig.model, messages, {
        temperature: llmConfig.temperature,
        maxTokens: llmConfig.maxTokens,
      });
    } else if (llmConfig.provider === "OPENAI") {
      // TODO: Implement OpenAI
      throw new Error("OpenAI provider not yet implemented");
    } else {
      throw new Error(`Unsupported LLM provider: ${llmConfig.provider}`);
    }

    // Parse the response to extract queries
    const cypherMatch = llmResponse.match(/CYPHER:\s*```?\s*([\s\S]*?)(?:```|EXPLANATION:|SQL:|$)/i);
    const sqlMatch = llmResponse.match(/SQL:\s*```?\s*([\s\S]*?)(?:```|EXPLANATION:|CYPHER:|$)/i);
    const explanationMatch = llmResponse.match(/EXPLANATION:\s*([\s\S]*?)$/i);

    const queries: ChatResponse["queries"] = {};
    const results: ChatResponse["results"] = {};

    // Execute Cypher query if present
    if (cypherMatch && cypherMatch[1].trim()) {
      const cypherQuery = cypherMatch[1].trim();
      queries.cypher = cypherQuery;

      try {
        const result = await neo4jService.executeCypher(cypherQuery, {}, "STAGING");
        results.graph = result.records.map((record) => record.toObject());
      } catch (error: any) {
        results.graph = { error: error.message };
      }
    }

    // Execute SQL query if present
    if (sqlMatch && sqlMatch[1].trim()) {
      const sqlQuery = sqlMatch[1].trim();
      queries.sql = sqlQuery;

      try {
        results.postgres = await prisma.$queryRawUnsafe(sqlQuery);
      } catch (error: any) {
        results.postgres = { error: error.message };
      }
    }

    // Build final answer
    let answer = explanationMatch ? explanationMatch[1].trim() : llmResponse;

    // If we have results, append them to the answer
    if (results.graph && !results.graph.error) {
      answer += `\n\nGraph results: ${JSON.stringify(results.graph, null, 2)}`;
    }
    if (results.postgres && !results.postgres.error) {
      answer += `\n\nDatabase results: ${JSON.stringify(results.postgres, null, 2)}`;
    }

    return {
      answer,
      queries,
      results,
    };
  }

  /**
   * Stream chat responses
   */
  async *chatStream(
    request: ChatRequest,
    llmConfigId?: string
  ): AsyncGenerator<{ type: "token" | "query" | "result"; data: any }> {
    const llmConfig = await this.getLlmConfig(llmConfigId);

    if (!llmConfig) {
      throw new Error("No active LLM configuration found");
    }

    // Build system prompt based on context
    let systemPrompt = COMBINED_SYSTEM_PROMPT;
    if (request.context === "graph") {
      systemPrompt = GRAPH_SYSTEM_PROMPT;
    } else if (request.context === "postgres") {
      systemPrompt = POSTGRES_SYSTEM_PROMPT;
    }

    // Build messages array
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...(request.history || []),
      { role: "user", content: request.message },
    ];

    // Stream LLM response
    if (llmConfig.provider === "OLLAMA") {
      const baseUrl = llmConfig.baseUrl || "http://localhost:11434";
      const ollama = new (await import("./ollamaService.js")).OllamaService(baseUrl);

      let fullResponse = "";

      for await (const token of ollama.chatStream(llmConfig.model, messages, {
        temperature: llmConfig.temperature,
        maxTokens: llmConfig.maxTokens,
      })) {
        fullResponse += token;
        yield { type: "token", data: token };
      }

      // After streaming is complete, parse and execute queries
      const cypherMatch = fullResponse.match(/CYPHER:\s*```?\s*([\s\S]*?)(?:```|EXPLANATION:|SQL:|$)/i);
      const sqlMatch = fullResponse.match(/SQL:\s*```?\s*([\s\S]*?)(?:```|EXPLANATION:|CYPHER:|$)/i);

      if (cypherMatch && cypherMatch[1].trim()) {
        const cypherQuery = cypherMatch[1].trim();
        yield { type: "query", data: { type: "cypher", query: cypherQuery } };

        try {
          const result = await neo4jService.executeCypher(cypherQuery, {}, "STAGING");
          const data = result.records.map((record) => record.toObject());
          yield { type: "result", data: { type: "graph", result: data } };
        } catch (error: any) {
          yield { type: "result", data: { type: "graph", error: error.message } };
        }
      }

      if (sqlMatch && sqlMatch[1].trim()) {
        const sqlQuery = sqlMatch[1].trim();
        yield { type: "query", data: { type: "sql", query: sqlQuery } };

        try {
          const result = await prisma.$queryRawUnsafe(sqlQuery);
          yield { type: "result", data: { type: "postgres", result } };
        } catch (error: any) {
          yield { type: "result", data: { type: "postgres", error: error.message } };
        }
      }
    } else {
      throw new Error(`Streaming not supported for provider: ${llmConfig.provider}`);
    }
  }
}

export const llmChatService = new LlmChatService();
