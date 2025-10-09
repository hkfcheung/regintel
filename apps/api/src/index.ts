import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { healthRoutes } from "./routes/health.js";

const fastify = Fastify({
  logger: {
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },
});

// Security & rate limiting
await fastify.register(helmet);
await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
});
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

// Routes
await fastify.register(healthRoutes, { prefix: "/health" });

// Import routes dynamically to avoid top-level await issues
const { ingestRoutes } = await import("./routes/ingest.js");
await fastify.register(ingestRoutes, { prefix: "/ingest" });

const { analysisRoutes } = await import("./routes/analysis.js");
await fastify.register(analysisRoutes, { prefix: "/analysis" });

const { rssRoutes } = await import("./routes/rss.js");
await fastify.register(rssRoutes, { prefix: "/rss" });

const { domainRoutes } = await import("./routes/domains.js");
await fastify.register(domainRoutes, { prefix: "/domains" });

const { discoveryRoutes } = await import("./routes/discovery.js");
await fastify.register(discoveryRoutes, { prefix: "/discovery" });

const { userRoutes } = await import("./routes/users.js");
await fastify.register(userRoutes, { prefix: "/users" });

const { knowledgeRoutes } = await import("./routes/knowledge.js");
await fastify.register(knowledgeRoutes, { prefix: "/knowledge" });

const { reviewRoutes } = await import("./routes/review.js");
await fastify.register(reviewRoutes, { prefix: "/review" });

const { auditRoutes } = await import("./routes/audit.js");
await fastify.register(auditRoutes, { prefix: "/audit" });

const { sessionRoutes } = await import("./routes/sessions.js");
await fastify.register(sessionRoutes, { prefix: "/sessions" });

const { analyticsRoutes } = await import("./routes/analytics.js");
await fastify.register(analyticsRoutes, { prefix: "/analytics" });

const { alertsRoutes } = await import("./routes/alerts.js");
await fastify.register(alertsRoutes, { prefix: "/alerts" });

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || "3001");
    await fastify.listen({ port, host: "0.0.0.0" });
    fastify.log.info(`API server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
