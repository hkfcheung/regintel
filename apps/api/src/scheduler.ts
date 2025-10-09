/**
 * Scheduler for automated background tasks
 *
 * Sets up repeatable jobs for:
 * - RSS feed polling
 * - Discovery runs
 */

import "dotenv/config";
import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: null,
});

// Initialize queues
const rssPollQueue = new Queue("rss-poll", { connection });
const discoveryQueue = new Queue("discovery", { connection });
const alertsQueue = new Queue("alerts", { connection });

async function setupScheduler() {
  console.log("Setting up scheduler...");

  // Clear any existing repeatable jobs to avoid duplicates
  const repeatableJobs = await rssPollQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await rssPollQueue.removeRepeatableByKey(job.key);
  }

  // Schedule RSS polling every 5 minutes
  // This will check which feeds are due and poll them
  await rssPollQueue.add(
    "poll-all-feeds",
    {},
    {
      repeat: {
        pattern: "*/5 * * * *", // Every 5 minutes (cron format)
      },
      jobId: "rss-poll-scheduler",
    }
  );

  console.log("✓ RSS polling scheduled (every 5 minutes)");

  // Schedule discovery runs every 24 hours
  await discoveryQueue.add(
    "discovery-all-domains",
    {},
    {
      repeat: {
        pattern: "0 2 * * *", // Daily at 2 AM (cron format)
      },
      jobId: "discovery-scheduler",
    }
  );

  console.log("✓ Discovery scheduled (daily at 2 AM)");

  // Schedule alert processing every hour
  await alertsQueue.add(
    "process-alerts",
    {},
    {
      repeat: {
        pattern: "0 * * * *", // Every hour (cron format)
      },
      jobId: "alerts-scheduler",
    }
  );

  console.log("✓ Alert processing scheduled (every hour)");

  // Optionally: Add an immediate first run
  await rssPollQueue.add("poll-all-feeds-immediate", {}, {
    priority: 1,
  });
  console.log("✓ Immediate RSS poll job added");

  console.log("\nScheduler setup complete!");
  console.log("Active repeatable jobs:");
  const jobs = await rssPollQueue.getRepeatableJobs();
  jobs.forEach((job) => {
    console.log(`  - ${job.name} (${job.pattern || job.cron})`);
  });
}

// Run setup
setupScheduler()
  .then(() => {
    console.log("\n✓ Scheduler is running");
    console.log("Press Ctrl+C to exit");
  })
  .catch((error) => {
    console.error("Failed to setup scheduler:", error);
    process.exit(1);
  });

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("\nShutting down scheduler...");
  await rssPollQueue.close();
  await discoveryQueue.close();
  await alertsQueue.close();
  await connection.quit();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("\nShutting down scheduler...");
  await rssPollQueue.close();
  await discoveryQueue.close();
  await alertsQueue.close();
  await connection.quit();
  process.exit(0);
});
