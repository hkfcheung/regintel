import type { FastifyInstance } from "fastify";

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get("/", async (request, reply) => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  fastify.get("/ready", async (request, reply) => {
    const { prisma } = await import("@regintel/database");
    const { RaindropService } = await import("../services/raindrop.js");
    const IORedis = (await import("ioredis")).default;

    const checks: Record<string, string> = {};

    // Check Postgres
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = "ok";
    } catch (error) {
      checks.database = "error";
    }

    // Check Redis
    try {
      const redis = new IORedis({
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
      });
      await redis.ping();
      await redis.quit();
      checks.redis = "ok";
    } catch (error) {
      checks.redis = "error";
    }

    // Check Raindrop MCP
    const raindrop = new RaindropService();
    checks.raindrop = (await raindrop.isAvailable()) ? "ok" : "unavailable";

    const allOk = Object.values(checks).every((v) => v === "ok" || v === "unavailable");

    return reply.code(allOk ? 200 : 503).send({
      status: allOk ? "ready" : "degraded",
      checks,
    });
  });

  fastify.get("/system", async (request, reply) => {
    try {
      const { prisma } = await import("@regintel/database");
      const { Queue } = await import("bullmq");
      const IORedis = (await import("ioredis")).default;

      const connection = new IORedis({
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        maxRetriesPerRequest: null,
      });

      // Database counts
      const [sourceItemCount, analysisCount, feedCount, domainCount] = await Promise.all([
        prisma.sourceItem.count(),
        prisma.analysis.count(),
        prisma.rssFeed.count({ where: { active: true } }),
        prisma.allowedDomain.count({ where: { active: true } }),
      ]);

      // Queue metrics
      const queueNames = ["ingest", "summarize", "rss-poll", "discovery"];
      const queueMetrics = await Promise.all(
        queueNames.map(async (name) => {
          const queue = new Queue(name, { connection });
          const [waiting, active, completed, failed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
          ]);

          return {
            name,
            waiting,
            active,
            completed,
            failed,
          };
        })
      );

      // Redis status
      let redisStatus = "connected";
      try {
        await connection.ping();
      } catch (error) {
        redisStatus = "disconnected";
      }

      await connection.quit();

      return reply.send({
        status: "ok",
        timestamp: new Date().toISOString(),
        database: {
          sourceItems: sourceItemCount,
          analyses: analysisCount,
          activeFeeds: feedCount,
          activeDomains: domainCount,
        },
        queues: queueMetrics,
        redis: redisStatus,
      });
    } catch (error) {
      return reply.status(500).send({
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}
