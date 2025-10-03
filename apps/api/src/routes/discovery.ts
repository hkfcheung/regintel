/**
 * Autonomous Discovery API Routes
 */

import { FastifyPluginAsync } from "fastify";
import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: null,
});

const discoveryQueue = new Queue("discovery", { connection });

export const discoveryRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /discovery/due - Get domains due for discovery
   */
  fastify.get("/due", async (request, reply) => {
    try {
      const { AutonomousDiscoveryService } = await import("../services/autonomousDiscovery.js");
      const discoveryService = new AutonomousDiscoveryService();
      const domains = await discoveryService.getDomainsDueForDiscovery();

      return reply.send({
        success: true,
        domains,
        count: domains.length,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get due domains",
      });
    }
  });

  /**
   * POST /discovery/run - Trigger autonomous discovery
   */
  fastify.post("/run", async (request, reply) => {
    try {
      const body = request.body as { domain?: string };

      const job = await discoveryQueue.add(
        "discover-documents",
        { domain: body.domain },
        { removeOnComplete: 100, removeOnFail: 100 }
      );

      return reply.send({
        success: true,
        jobId: job.id,
        message: body.domain
          ? `Discovery queued for domain ${body.domain}`
          : "Discovery queued for all active domains",
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to queue discovery job",
      });
    }
  });

  /**
   * POST /discovery/run-scheduled - Run discovery for domains that are due
   */
  fastify.post("/run-scheduled", async (request, reply) => {
    try {
      const { AutonomousDiscoveryService } = await import("../services/autonomousDiscovery.js");
      const discoveryService = new AutonomousDiscoveryService();
      const domains = await discoveryService.getDomainsDueForDiscovery();

      const jobs = [];
      for (const domain of domains) {
        const job = await discoveryQueue.add(
          "discover-documents",
          { domain: domain.domain },
          { removeOnComplete: 100, removeOnFail: 100 }
        );
        jobs.push({ domain: domain.domain, jobId: job.id });
      }

      return reply.send({
        success: true,
        message: `Queued discovery for ${jobs.length} domains`,
        jobs,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to queue scheduled discovery",
      });
    }
  });

  /**
   * GET /discovery/status/:jobId - Check discovery job status
   */
  fastify.get("/status/:jobId", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    try {
      const job = await discoveryQueue.getJob(jobId);

      if (!job) {
        return reply.status(404).send({
          success: false,
          error: "Job not found",
        });
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
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get job status",
      });
    }
  });
};
