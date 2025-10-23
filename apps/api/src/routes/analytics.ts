import { FastifyInstance } from "fastify";
import {
  getOverviewStats,
  getTimeSeriesData,
  getTypeDistribution,
  getRegionDistribution,
  getTopTags,
  getFeedAnalytics,
  getReviewStatusDistribution,
  getSourceDistribution,
} from "../services/analyticsService.js";

export default async function analyticsRoutes(fastify: FastifyInstance) {
  // Get overview statistics
  fastify.get("/overview", async (request, reply) => {
    try {
      const stats = await getOverviewStats();
      return reply.send(stats);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch overview stats" });
    }
  });

  // Get time series data
  fastify.get<{
    Querystring: { days?: string };
  }>("/timeseries", async (request, reply) => {
    try {
      const days = parseInt(request.query.days || "30", 10);
      const data = await getTimeSeriesData(days);
      return reply.send(data);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch time series data" });
    }
  });

  // Get type distribution
  fastify.get("/distribution/type", async (request, reply) => {
    try {
      const data = await getTypeDistribution();
      return reply.send(data);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch type distribution" });
    }
  });

  // Get region distribution
  fastify.get("/distribution/region", async (request, reply) => {
    try {
      const data = await getRegionDistribution();
      return reply.send(data);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch region distribution" });
    }
  });

  // Get review status distribution
  fastify.get("/distribution/status", async (request, reply) => {
    try {
      const data = await getReviewStatusDistribution();
      return reply.send(data);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch status distribution" });
    }
  });

  // Get source distribution
  fastify.get<{
    Querystring: { limit?: string };
  }>("/distribution/source", async (request, reply) => {
    try {
      const limit = parseInt(request.query.limit || "10", 10);
      const data = await getSourceDistribution(limit);
      return reply.send(data);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch source distribution" });
    }
  });

  // Get top tags
  fastify.get<{
    Querystring: { limit?: string };
  }>("/tags", async (request, reply) => {
    try {
      const limit = parseInt(request.query.limit || "20", 10);
      const data = await getTopTags(limit);
      return reply.send(data);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch top tags" });
    }
  });

  // Get feed analytics
  fastify.get("/feeds", async (request, reply) => {
    try {
      const data = await getFeedAnalytics();
      return reply.send(data);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch feed analytics" });
    }
  });

  // Get all analytics data (comprehensive)
  fastify.get<{
    Querystring: { days?: string };
  }>("/all", async (request, reply) => {
    try {
      const days = parseInt(request.query.days || "30", 10);

      const [
        overview,
        timeSeries,
        typeDistribution,
        regionDistribution,
        statusDistribution,
        sourceDistribution,
        topTags,
        feedAnalytics,
      ] = await Promise.all([
        getOverviewStats(),
        getTimeSeriesData(days),
        getTypeDistribution(),
        getRegionDistribution(),
        getReviewStatusDistribution(),
        getSourceDistribution(10),
        getTopTags(20),
        getFeedAnalytics(),
      ]);

      return reply.send({
        overview,
        timeSeries,
        distributions: {
          type: typeDistribution,
          region: regionDistribution,
          status: statusDistribution,
          source: sourceDistribution,
        },
        topTags,
        feedAnalytics,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch analytics data" });
    }
  });
}
