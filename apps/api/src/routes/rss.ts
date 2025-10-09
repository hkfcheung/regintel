/**
 * RSS Feed Management API Routes
 */

import { FastifyPluginAsync } from "fastify";
import { prisma } from "@regintel/database";
import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: null,
});

const rssPollQueue = new Queue("rss-poll", { connection });

export const rssRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /rss/poll - Trigger RSS polling manually
   */
  fastify.post("/poll", async (request, reply) => {
    try {
      const body = request.body as { feedId?: string };

      const job = await rssPollQueue.add(
        "poll-feeds",
        { feedId: body.feedId },
        { removeOnComplete: 100, removeOnFail: 100 }
      );

      return reply.send({
        success: true,
        jobId: job.id,
        message: body.feedId
          ? `RSS poll queued for feed ${body.feedId}`
          : "RSS poll queued for all active feeds",
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to queue RSS poll",
      });
    }
  });

  /**
   * GET /rss/status/:jobId - Check RSS poll job status
   */
  fastify.get("/status/:jobId", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    try {
      const job = await rssPollQueue.getJob(jobId);

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

  /**
   * GET /rss/feeds - List all RSS feeds
   */
  fastify.get("/feeds", async (request, reply) => {
    try {
      const feeds = await prisma.rssFeed.findMany({
        orderBy: { createdAt: "desc" },
      });

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
      const feedsWithCounts = feeds.map((feed) => ({
        ...feed,
        todaysIngestions: countsByFeed.get(feed.id) || 0,
      }));

      return reply.send({ feeds: feedsWithCounts });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch feeds",
      });
    }
  });

  /**
   * POST /rss/feeds - Create a new RSS feed
   */
  fastify.post("/feeds", async (request, reply) => {
    const body = request.body as {
      url: string;
      title: string;
      description?: string;
      classifications?: string[];
      pollInterval?: number;
      active?: boolean;
    };

    try {
      const feed = await prisma.rssFeed.create({
        data: {
          url: body.url,
          title: body.title,
          description: body.description,
          classifications: body.classifications || [],
          pollInterval: body.pollInterval || 3600,
          active: body.active ?? true,
        },
      });

      return reply.status(201).send({ success: true, feed });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to create feed",
      });
    }
  });

  /**
   * PATCH /rss/feeds/:id - Update an RSS feed
   */
  fastify.patch("/feeds/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      url?: string;
      title?: string;
      description?: string;
      classifications?: string[];
      pollInterval?: number;
      active?: boolean;
    };

    try {
      const feed = await prisma.rssFeed.update({
        where: { id },
        data: body,
      });

      return reply.send({ success: true, feed });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to update feed",
      });
    }
  });

  /**
   * DELETE /rss/feeds/:id - Delete an RSS feed
   */
  fastify.delete("/feeds/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      await prisma.rssFeed.delete({
        where: { id },
      });

      return reply.send({ success: true });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete feed",
      });
    }
  });
};
