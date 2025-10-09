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
      const [sourceItemCount, analysisCount, feedCount, domainCount, feeds] = await Promise.all([
        prisma.sourceItem.count(),
        prisma.analysis.count(),
        prisma.rssFeed.count({ where: { active: true } }),
        prisma.allowedDomain.count({ where: { active: true } }),
        prisma.rssFeed.findMany({
          where: { active: true },
          select: {
            id: true,
            title: true,
            url: true,
          },
        }),
      ]);

      // Get today's ingestion counts per RSS feed
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todaysCounts = await prisma.sourceItem.groupBy({
        by: ["rssFeedId"],
        where: {
          createdAt: {
            gte: today,
          },
        },
        _count: {
          id: true,
        },
      });

      // Create a map of rssFeedId -> count
      const countsByFeed = new Map<string, number>();

      todaysCounts.forEach((item) => {
        if (item.rssFeedId) {
          countsByFeed.set(item.rssFeedId, item._count.id);
        }
      });

      // For items without rssFeedId (old items), match by domain
      const nullCount = todaysCounts.find((item) => item.rssFeedId === null);
      if (nullCount && nullCount._count.id > 0) {
        // Get domain-based counts for items without rssFeedId
        const domainCounts = await prisma.sourceItem.groupBy({
          by: ["sourceDomain"],
          where: {
            createdAt: {
              gte: today,
            },
            rssFeedId: null,
          },
          _count: {
            id: true,
          },
        });

        // Match domains to feeds and add to counts
        const domainCountMap = new Map(
          domainCounts.map((item) => [item.sourceDomain, item._count.id])
        );

        feeds.forEach((feed) => {
          try {
            const url = new URL(feed.url);
            const domain = url.hostname.replace(/^www\./, "");

            const domainCount =
              domainCountMap.get(url.hostname) ||
              domainCountMap.get(domain) ||
              domainCountMap.get(`www.${domain}`) ||
              0;

            if (domainCount > 0) {
              const currentCount = countsByFeed.get(feed.id) || 0;
              countsByFeed.set(feed.id, currentCount + domainCount);
            }
          } catch (error) {
            // Invalid URL, skip
          }
        });
      }

      // Add counts to feeds
      const feedStatus = feeds.map((feed) => ({
        title: feed.title,
        todaysIngestions: countsByFeed.get(feed.id) || 0,
      }));

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
        feedStatus,
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
