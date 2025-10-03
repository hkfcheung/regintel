import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@regintel/database";

const createSessionSchema = z.object({
  userId: z.string(),
  title: z.string().optional(),
});

const updateSessionSchema = z.object({
  title: z.string(),
});

const addQuerySchema = z.object({
  query: z.string(),
  results: z.array(z.any()),
});

export async function sessionRoutes(fastify: FastifyInstance) {
  // Get all sessions for a user
  fastify.get("/user/:userId", async (request, reply) => {
    const { userId } = request.params as { userId: string };

    try {
      const sessions = await prisma.searchSession.findMany({
        where: { userId },
        include: {
          queries: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      return reply.send({ sessions });
    } catch (error: any) {
      fastify.log.error("Error fetching sessions:", error);
      return reply.status(500).send({ error: "Failed to fetch sessions" });
    }
  });

  // Create new session
  fastify.post("/", async (request, reply) => {
    fastify.log.info("POST /sessions - body:", request.body);
    const validation = createSessionSchema.safeParse(request.body);
    if (!validation.success) {
      fastify.log.error("Validation failed:", validation.error);
      return reply.status(400).send({ error: validation.error.message });
    }

    const { userId, title } = validation.data;
    fastify.log.info("Creating session for userId:", userId, "title:", title);

    try {
      const session = await prisma.searchSession.create({
        data: {
          userId,
          title: title || "New Search",
        },
      });

      fastify.log.info("Session created successfully:", session.id);
      return reply.send({ session });
    } catch (error: any) {
      fastify.log.error("Error creating session:", error);
      return reply.status(500).send({ error: "Failed to create session", details: error.message });
    }
  });

  // Get single session with queries
  fastify.get("/:sessionId", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    try {
      const session = await prisma.searchSession.findUnique({
        where: { id: sessionId },
        include: {
          queries: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!session) {
        return reply.status(404).send({ error: "Session not found" });
      }

      return reply.send({ session });
    } catch (error: any) {
      fastify.log.error("Error fetching session:", error);
      return reply.status(500).send({ error: "Failed to fetch session" });
    }
  });

  // Update session title
  fastify.patch("/:sessionId", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const validation = updateSessionSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: validation.error.message });
    }

    const { title } = validation.data;

    try {
      const session = await prisma.searchSession.update({
        where: { id: sessionId },
        data: { title },
      });

      return reply.send({ session });
    } catch (error: any) {
      fastify.log.error("Error updating session:", error);
      return reply.status(500).send({ error: "Failed to update session" });
    }
  });

  // Add query to session
  fastify.post("/:sessionId/queries", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const validation = addQuerySchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: validation.error.message });
    }

    const { query, results } = validation.data;

    try {
      const searchQuery = await prisma.searchQuery.create({
        data: {
          sessionId,
          query,
          results,
        },
      });

      // Update session updatedAt
      await prisma.searchSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });

      return reply.send({ query: searchQuery });
    } catch (error: any) {
      fastify.log.error("Error adding query:", error);
      return reply.status(500).send({ error: "Failed to add query" });
    }
  });

  // Delete session
  fastify.delete("/:sessionId", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    try {
      await prisma.searchSession.delete({
        where: { id: sessionId },
      });

      return reply.send({ message: "Session deleted" });
    } catch (error: any) {
      fastify.log.error("Error deleting session:", error);
      return reply.status(500).send({ error: "Failed to delete session" });
    }
  });

  // Export session to JSON
  fastify.get("/:sessionId/export", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    try {
      const session = await prisma.searchSession.findUnique({
        where: { id: sessionId },
        include: {
          queries: {
            orderBy: { createdAt: "asc" },
          },
          user: {
            select: { email: true, name: true },
          },
        },
      });

      if (!session) {
        return reply.status(404).send({ error: "Session not found" });
      }

      const exportData = {
        title: session.title,
        user: session.user,
        createdAt: session.createdAt,
        queries: session.queries.map(q => ({
          query: q.query,
          results: q.results,
          timestamp: q.createdAt,
        })),
      };

      reply.header("Content-Type", "application/json");
      reply.header("Content-Disposition", `attachment; filename="search-session-${sessionId}.json"`);
      return reply.send(exportData);
    } catch (error: any) {
      fastify.log.error("Error exporting session:", error);
      return reply.status(500).send({ error: "Failed to export session" });
    }
  });
}
