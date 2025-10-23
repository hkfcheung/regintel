import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@regintel/database";
import { llmChatService } from "../services/llmChatService.js";
import { ollamaService, OllamaService } from "../services/ollamaService.js";

const chatRequestSchema = z.object({
  message: z.string().min(1),
  context: z.enum(["graph", "postgres", "both"]).optional().default("both"),
  history: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string(),
      })
    )
    .optional(),
  llmConfigId: z.string().optional(),
});

const llmConfigSchema = z.object({
  name: z.string().min(1),
  provider: z.enum(["OLLAMA", "OPENAI", "ANTHROPIC", "CUSTOM"]),
  model: z.string().min(1),
  baseUrl: z.string().url().optional().nullable(),
  apiKey: z.string().optional().nullable(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(100000).default(2000),
  active: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  capabilities: z.array(z.string()).default(["graph", "postgres", "general"]),
});

export async function llmRoutes(fastify: FastifyInstance) {
  // Chat endpoint
  fastify.post("/chat", async (request, reply) => {
    try {
      const body = chatRequestSchema.parse(request.body);

      const response = await llmChatService.chat(
        {
          message: body.message,
          context: body.context,
          history: body.history,
        },
        body.llmConfigId
      );

      return reply.send(response);
    } catch (error: any) {
      fastify.log.error("Error in LLM chat:", error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Stream chat endpoint
  fastify.get("/chat/stream", async (request, reply) => {
    try {
      const query = z
        .object({
          message: z.string().min(1),
          context: z.enum(["graph", "postgres", "both"]).optional().default("both"),
          llmConfigId: z.string().optional(),
        })
        .parse(request.query);

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      for await (const chunk of llmChatService.chatStream({
        message: query.message,
        context: query.context,
      }, query.llmConfigId)) {
        reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      reply.raw.end();
    } catch (error: any) {
      fastify.log.error("Error in LLM stream:", error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // List LLM configurations
  fastify.get("/configs", async (request, reply) => {
    try {
      const configs = await prisma.llmConfig.findMany({
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      });

      return reply.send(configs);
    } catch (error: any) {
      fastify.log.error("Error listing LLM configs:", error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get single LLM configuration
  fastify.get("/configs/:id", async (request, reply) => {
    try {
      const params = z.object({ id: z.string() }).parse(request.params);

      const config = await prisma.llmConfig.findUnique({
        where: { id: params.id },
      });

      if (!config) {
        return reply.status(404).send({ error: "LLM config not found" });
      }

      return reply.send(config);
    } catch (error: any) {
      fastify.log.error("Error getting LLM config:", error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Create LLM configuration
  fastify.post("/configs", async (request, reply) => {
    try {
      const body = llmConfigSchema.parse(request.body);

      // If this is set as default, unset other defaults
      if (body.isDefault) {
        await prisma.llmConfig.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      const config = await prisma.llmConfig.create({
        data: body,
      });

      return reply.send(config);
    } catch (error: any) {
      fastify.log.error("Error creating LLM config:", error);

      // Handle Zod validation errors
      if (error.name === "ZodError") {
        return reply.status(400).send({
          error: "Validation failed: " + error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(", ")
        });
      }

      // Handle Prisma unique constraint errors
      if (error.code === "P2002") {
        return reply.status(400).send({ error: "A configuration with this name already exists" });
      }

      return reply.status(500).send({ error: error.message });
    }
  });

  // Update LLM configuration
  fastify.put("/configs/:id", async (request, reply) => {
    try {
      const params = z.object({ id: z.string() }).parse(request.params);
      const body = llmConfigSchema.partial().parse(request.body);

      // If this is set as default, unset other defaults
      if (body.isDefault) {
        await prisma.llmConfig.updateMany({
          where: { isDefault: true, NOT: { id: params.id } },
          data: { isDefault: false },
        });
      }

      const config = await prisma.llmConfig.update({
        where: { id: params.id },
        data: body,
      });

      return reply.send(config);
    } catch (error: any) {
      fastify.log.error("Error updating LLM config:", error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Delete LLM configuration
  fastify.delete("/configs/:id", async (request, reply) => {
    try {
      const params = z.object({ id: z.string() }).parse(request.params);

      await prisma.llmConfig.delete({
        where: { id: params.id },
      });

      return reply.send({ message: "LLM config deleted" });
    } catch (error: any) {
      fastify.log.error("Error deleting LLM config:", error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // List available Ollama models
  fastify.get("/ollama/models", async (request, reply) => {
    try {
      const query = z
        .object({
          baseUrl: z.string().url().optional(),
        })
        .parse(request.query);

      const ollama = query.baseUrl
        ? new OllamaService(query.baseUrl)
        : ollamaService;

      const models = await ollama.listModels();

      return reply.send({ models });
    } catch (error: any) {
      fastify.log.error("Error listing Ollama models:", error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Check Ollama health
  fastify.get("/ollama/health", async (request, reply) => {
    try {
      const query = z
        .object({
          baseUrl: z.string().url().optional(),
        })
        .parse(request.query);

      const ollama = query.baseUrl
        ? new OllamaService(query.baseUrl)
        : ollamaService;

      const healthy = await ollama.healthCheck();

      return reply.send({ healthy, baseUrl: ollama["baseUrl"] });
    } catch (error: any) {
      fastify.log.error("Error checking Ollama health:", error);
      return reply.status(500).send({ error: error.message });
    }
  });
}
