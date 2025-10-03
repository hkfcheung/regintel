import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@regintel/database";
import { getSmartBucketService } from "../services/smartBucket.js";

const approveSchema = z.object({
  sourceItemId: z.string(),
  userId: z.string(),
});

const rejectSchema = z.object({
  sourceItemId: z.string(),
  userId: z.string(),
});

const revisionSchema = z.object({
  sourceItemId: z.string(),
  notes: z.string().optional(),
});

export async function reviewRoutes(fastify: FastifyInstance) {
  // Approve a source item
  fastify.post("/approve", async (request, reply) => {
    const validation = approveSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: validation.error.message });
    }

    const { sourceItemId, userId } = validation.data;

    try {
      // Get current status before update
      const currentItem = await prisma.sourceItem.findUnique({
        where: { id: sourceItemId },
        select: { status: true },
      });

      // Update status to APPROVED
      const sourceItem = await prisma.sourceItem.update({
        where: { id: sourceItemId },
        data: { status: "APPROVED" },
        include: {
          analyses: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      // Log the approval
      await prisma.auditLog.create({
        data: {
          actor: userId,
          action: "source_item.approved",
          entity: "source_item",
          entityId: sourceItemId,
          diff: { before: { status: currentItem?.status }, after: { status: "APPROVED" } },
        },
      });

      // Automatically store in knowledge base
      if (sourceItem.analyses.length > 0) {
        const analysis = sourceItem.analyses[0];
        let modelMeta: any = {};
        try {
          modelMeta = typeof analysis.modelMeta === 'string'
            ? JSON.parse(analysis.modelMeta)
            : analysis.modelMeta || {};
        } catch (e) {
          // ignore parse errors
        }

        const smartBucket = getSmartBucketService();
        await smartBucket.storeDocument({
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

        fastify.log.info(`Auto-stored document ${sourceItemId} in knowledge base`);
      }

      return reply.send({ message: "Document approved and stored in knowledge base", sourceItem });
    } catch (error: any) {
      fastify.log.error("Error approving document:", error);
      return reply.status(500).send({ error: "Failed to approve document" });
    }
  });

  // Reject a source item
  fastify.post("/reject", async (request, reply) => {
    const validation = rejectSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: validation.error.message });
    }

    const { sourceItemId, userId } = validation.data;

    try {
      // Get current status before update
      const currentItem = await prisma.sourceItem.findUnique({
        where: { id: sourceItemId },
        select: { status: true },
      });

      const sourceItem = await prisma.sourceItem.update({
        where: { id: sourceItemId },
        data: { status: "REJECTED" },
      });

      // Log the rejection
      await prisma.auditLog.create({
        data: {
          actor: userId,
          action: "source_item.rejected",
          entity: "source_item",
          entityId: sourceItemId,
          diff: { before: { status: currentItem?.status }, after: { status: "REJECTED" } },
        },
      });

      return reply.send({ message: "Document rejected", sourceItem });
    } catch (error: any) {
      fastify.log.error("Error rejecting document:", error);
      return reply.status(500).send({ error: "Failed to reject document" });
    }
  });

  // Request revision
  fastify.post("/revision", async (request, reply) => {
    const validation = revisionSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: validation.error.message });
    }

    const { sourceItemId, notes } = validation.data;

    try {
      const sourceItem = await prisma.sourceItem.update({
        where: { id: sourceItemId },
        data: { status: "REVISION" },
      });

      // TODO: Add audit logging once we have session/user context

      return reply.send({ message: "Revision requested", sourceItem });
    } catch (error: any) {
      fastify.log.error("Error requesting revision:", error);
      return reply.status(500).send({ error: "Failed to request revision" });
    }
  });
}
