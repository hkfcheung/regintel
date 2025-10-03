import type { FastifyInstance } from "fastify";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { z } from "zod";
import { prisma } from "@regintel/database";

const connection = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: null,
});

const summarizeQueue = new Queue("summarize", { connection });

const AnalysisRequestSchema = z.object({
  sourceItemId: z.string(),
});

export async function analysisRoutes(fastify: FastifyInstance) {
  /**
   * Trigger analysis job for a source item
   */
  fastify.post("/trigger", async (request, reply) => {
    const validation = AnalysisRequestSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.code(400).send({
        error: "Invalid request",
        details: validation.error.issues,
      });
    }

    const { sourceItemId } = validation.data;

    // Verify source item exists
    const sourceItem = await prisma.sourceItem.findUnique({
      where: { id: sourceItemId },
    });

    if (!sourceItem) {
      return reply.code(404).send({
        error: "Source item not found",
      });
    }

    // Check if already analyzed
    const existingAnalysis = await prisma.analysis.findFirst({
      where: { sourceItemId },
      orderBy: { createdAt: "desc" },
    });

    if (existingAnalysis) {
      return reply.send({
        success: true,
        analysisId: existingAnalysis.id,
        message: "Analysis already exists",
        existing: true,
      });
    }

    // Add job to queue
    const job = await summarizeQueue.add(
      "analyze-source",
      { sourceItemId },
      {
        jobId: `analyze-${sourceItemId}`,
        removeOnComplete: 100,
        removeOnFail: 1000,
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 10000,
        },
      }
    );

    return reply.send({
      success: true,
      jobId: job.id,
      message: "Analysis job queued",
    });
  });

  /**
   * Get analysis job status
   */
  fastify.get("/status/:jobId", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    const job = await summarizeQueue.getJob(jobId);

    if (!job) {
      return reply.code(404).send({ error: "Job not found" });
    }

    const state = await job.getState();
    const progress = job.progress;

    return reply.send({
      jobId: job.id,
      state,
      progress,
      data: job.data,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
    });
  });

  /**
   * Get analysis for a source item
   */
  fastify.get("/source/:sourceItemId", async (request, reply) => {
    const { sourceItemId } = request.params as { sourceItemId: string };

    const analyses = await prisma.analysis.findMany({
      where: { sourceItemId },
      orderBy: { createdAt: "desc" },
    });

    if (analyses.length === 0) {
      return reply.code(404).send({
        error: "No analysis found for this source item",
      });
    }

    return reply.send({
      analyses: analyses.map((analysis) => ({
        id: analysis.id,
        sourceItemId: analysis.sourceItemId,
        summaryMd: analysis.summaryMd,
        impactMd: analysis.impactMd,
        citations: analysis.citations,
        modelMeta: analysis.modelMeta,
        createdAt: analysis.createdAt,
      })),
    });
  });

  /**
   * Batch trigger analysis for all INTAKE items
   */
  fastify.post("/batch-trigger", async (request, reply) => {
    const intakeItems = await prisma.sourceItem.findMany({
      where: {
        status: "INTAKE",
      },
      select: { id: true },
    });

    const jobs = [];
    for (const item of intakeItems) {
      // Check if already analyzed
      const existingAnalysis = await prisma.analysis.findFirst({
        where: { sourceItemId: item.id },
      });

      if (!existingAnalysis) {
        const job = await summarizeQueue.add(
          "analyze-source",
          { sourceItemId: item.id },
          {
            jobId: `analyze-${item.id}`,
            removeOnComplete: 100,
            removeOnFail: 1000,
            attempts: 2,
          }
        );
        jobs.push(job.id);
      }
    }

    return reply.send({
      success: true,
      message: `Queued ${jobs.length} analysis jobs`,
      jobIds: jobs,
      total: intakeItems.length,
      alreadyAnalyzed: intakeItems.length - jobs.length,
    });
  });
}
