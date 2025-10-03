import type { FastifyInstance } from "fastify";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { z } from "zod";

const connection = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: null,
});

const ingestQueue = new Queue("ingest", { connection });

const IngestRequestSchema = z.object({
  url: z.string().url(),
  source: z.string().optional(),
  type: z.enum([
    "guidance",
    "warning_letter",
    "untitled_letter",
    "meeting",
    "approval",
    "press",
  ]).optional(),
});

export async function ingestRoutes(fastify: FastifyInstance) {
  /**
   * Trigger ingest job for a single URL
   */
  fastify.post("/trigger", async (request, reply) => {
    const validation = IngestRequestSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.code(400).send({
        error: "Invalid request",
        details: validation.error.issues,
      });
    }

    const { url, source, type } = validation.data;

    // Add job to queue with idempotency via URL hash
    const urlHash = Buffer.from(url).toString("base64").replace(/[+/=]/g, (m) => ({'+': '-', '/': '_', '=': ''}[m] || ''));
    const job = await ingestQueue.add(
      "fetch-and-process",
      { url, source, type },
      {
        jobId: `ingest-${urlHash}`,
        removeOnComplete: 100,
        removeOnFail: 1000,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      }
    );

    return reply.send({
      success: true,
      jobId: job.id,
      message: "Ingest job queued",
    });
  });

  /**
   * Get ingest job status
   */
  fastify.get("/status/:jobId", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    const job = await ingestQueue.getJob(jobId);

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
}
