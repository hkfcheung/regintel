import { FastifyInstance } from "fastify";
import { z } from "zod";
import { getSmartBucketService } from "../services/smartBucket.js";
import { prisma } from "@regintel/database";

const searchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().optional().default(10),
});

const storeSchema = z.object({
  sourceItemId: z.string(),
});

export async function knowledgeRoutes(fastify: FastifyInstance) {
  // Search the knowledge base
  fastify.post("/search", async (request, reply) => {
    const validation = searchSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: validation.error.message });
    }

    const { query, limit } = validation.data;

    try {
      const service = getSmartBucketService();
      const results = await service.searchDocuments(query, limit);

      return reply.send({ results, count: results.length });
    } catch (error: any) {
      console.error("Error searching knowledge base:", error);
      return reply.status(500).send({ error: "Failed to search knowledge base" });
    }
  });

  // Store a document in the knowledge base
  fastify.post("/store", async (request, reply) => {
    const validation = storeSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: validation.error.message });
    }

    const { sourceItemId } = validation.data;

    try {
      const sourceItem = await prisma.sourceItem.findUnique({
        where: { id: sourceItemId },
        include: {
          analyses: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!sourceItem) {
        return reply.status(404).send({ error: "Source item not found" });
      }

      if (sourceItem.analyses.length === 0) {
        return reply.status(400).send({ error: "Source item has no analysis" });
      }

      const analysis = sourceItem.analyses[0];
      let modelMeta: any = {};
      try {
        modelMeta = typeof analysis.modelMeta === 'string'
          ? JSON.parse(analysis.modelMeta)
          : analysis.modelMeta || {};
      } catch (e) {
        // ignore parse errors
      }

      const service = getSmartBucketService();
      const success = await service.storeDocument({
        sourceItemId: sourceItem.id,
        title: sourceItem.title,
        url: sourceItem.url,
        domain: sourceItem.sourceDomain,
        content: sourceItem.content,
        summary: analysis.summaryMd,
        impact: analysis.impactMd,
        classification: modelMeta.classification,
        pediatricDetails: modelMeta.pediatric_details,
      });

      if (success) {
        return reply.send({ message: "Document stored successfully" });
      } else {
        return reply.status(500).send({ error: "Failed to store document" });
      }
    } catch (error: any) {
      console.error("Error storing document:", error);
      return reply.status(500).send({ error: "Failed to store document" });
    }
  });

  // Find similar documents
  fastify.get("/similar/:sourceItemId", async (request, reply) => {
    const { sourceItemId } = request.params as { sourceItemId: string };

    try {
      const service = getSmartBucketService();
      const results = await service.findSimilarDocuments(sourceItemId, 5);

      return reply.send({ results, count: results.length });
    } catch (error: any) {
      console.error("Error finding similar documents:", error);
      return reply.status(500).send({ error: "Failed to find similar documents" });
    }
  });

  // Get knowledge base stats
  fastify.get("/stats", async (request, reply) => {
    try {
      const service = getSmartBucketService();
      const documentCount = await service.getDocumentCount();

      const [totalApproved, totalAnalyzed] = await Promise.all([
        prisma.sourceItem.count({ where: { status: "APPROVED" } }),
        prisma.analysis.count(),
      ]);

      return reply.send({
        documentsInKnowledgeBase: documentCount,
        totalApprovedDocuments: totalApproved,
        totalAnalyzed,
      });
    } catch (error: any) {
      console.error("Error getting knowledge base stats:", error);
      return reply.status(500).send({ error: "Failed to get stats" });
    }
  });

  // Bulk store approved documents
  fastify.post("/bulk-store", async (request, reply) => {
    try {
      const approvedItems = await prisma.sourceItem.findMany({
        where: { status: "APPROVED" },
        include: {
          analyses: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      const service = getSmartBucketService();
      let stored = 0;
      let failed = 0;

      for (const item of approvedItems) {
        if (item.analyses.length === 0) continue;

        const analysis = item.analyses[0];
        let modelMeta: any = {};
        try {
          modelMeta = typeof analysis.modelMeta === 'string'
            ? JSON.parse(analysis.modelMeta)
            : analysis.modelMeta || {};
        } catch (e) {
          // ignore
        }

        const success = await service.storeDocument({
          sourceItemId: item.id,
          title: item.title,
          url: item.url,
          domain: item.sourceDomain,
          content: item.content,
          summary: analysis.summaryMd,
          impact: analysis.impactMd,
          classification: modelMeta.classification,
          pediatricDetails: modelMeta.pediatric_details,
        });

        if (success) stored++;
        else failed++;
      }

      return reply.send({
        message: "Bulk store completed",
        stored,
        failed,
        total: approvedItems.length,
      });
    } catch (error: any) {
      console.error("Error bulk storing documents:", error);
      return reply.status(500).send({ error: "Failed to bulk store" });
    }
  });
}
