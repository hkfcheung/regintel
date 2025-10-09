import "dotenv/config";
import { Worker, Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: null,
});

// Job handlers
const processIngestJob = async (job: any) => {
  console.log(`Processing ingest job ${job.id}:`, job.data);

  const { IngestService } = await import("./services/ingest.js");
  const ingestService = new IngestService();

  const result = await ingestService.ingestUrl({
    url: job.data.url,
    source: job.data.source,
    type: job.data.type,
  });

  if (!result.success) {
    throw new Error(result.error || "Ingest failed");
  }

  return result;
};

const processSummarizeJob = async (job: any) => {
  console.log(`Processing summarize job ${job.id}:`, job.data);

  const { processAnalysisJob } = await import("./queues/analysisProcessor.js");
  const result = await processAnalysisJob(job);

  if (result.status === "failed") {
    throw new Error(result.error || "Analysis failed");
  }

  return result;
};

const processPublishJob = async (job: any) => {
  console.log(`Processing publish job ${job.id}:`, job.data);
  // TODO: Implement publish logic
  return { success: true };
};

const processRssPollJob = async (job: any) => {
  console.log(`Processing RSS poll job ${job.id}:`, job.data);

  const { processRssPollJob: pollHandler } = await import("./queues/rssPollProcessor.js");
  const result = await pollHandler(job);

  return result;
};

const processDiscoveryJob = async (job: any) => {
  console.log(`Processing discovery job ${job.id}:`, job.data);

  const { processDiscoveryJob: discoveryHandler } = await import("./queues/discoveryProcessor.js");
  const result = await discoveryHandler(job);

  return result;
};

const processAlertsJob = async (job: any) => {
  console.log(`Processing alerts job ${job.id}:`, job.data);

  const { processAllDueAlerts } = await import("./services/alertService.js");
  const result = await processAllDueAlerts();

  console.log(`Alerts processed: ${result.processed}, errors: ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.error("Alert processing errors:", result.errors);
  }

  return result;
};

// Workers
const ingestWorker = new Worker("ingest", processIngestJob, {
  connection,
  concurrency: 5,
});

const summarizeWorker = new Worker("summarize", processSummarizeJob, {
  connection,
  concurrency: 3,
});

const publishWorker = new Worker("publish", processPublishJob, {
  connection,
  concurrency: 1,
});

const rssPollWorker = new Worker("rss-poll", processRssPollJob, {
  connection,
  concurrency: 1,
});

const discoveryWorker = new Worker("discovery", processDiscoveryJob, {
  connection,
  concurrency: 1,
});

const alertsWorker = new Worker("alerts", processAlertsJob, {
  connection,
  concurrency: 1,
});

// Event listeners
ingestWorker.on("completed", (job) => {
  console.log(`Ingest job ${job.id} completed`);
});

ingestWorker.on("failed", (job, err) => {
  console.error(`Ingest job ${job?.id} failed:`, err);
});

summarizeWorker.on("completed", (job) => {
  console.log(`Summarize job ${job.id} completed`);
});

summarizeWorker.on("failed", (job, err) => {
  console.error(`Summarize job ${job?.id} failed:`, err);
});

publishWorker.on("completed", (job) => {
  console.log(`Publish job ${job.id} completed`);
});

publishWorker.on("failed", (job, err) => {
  console.error(`Publish job ${job?.id} failed:`, err);
});

rssPollWorker.on("completed", (job) => {
  console.log(`RSS poll job ${job.id} completed`);
});

rssPollWorker.on("failed", (job, err) => {
  console.error(`RSS poll job ${job?.id} failed:`, err);
});

discoveryWorker.on("completed", (job) => {
  console.log(`Discovery job ${job.id} completed`);
});

discoveryWorker.on("failed", (job, err) => {
  console.error(`Discovery job ${job?.id} failed:`, err);
});

alertsWorker.on("completed", (job) => {
  console.log(`Alerts job ${job.id} completed`);
});

alertsWorker.on("failed", (job, err) => {
  console.error(`Alerts job ${job?.id} failed:`, err);
});

console.log("BullMQ workers started");
console.log("- Ingest worker (concurrency: 5)");
console.log("- Summarize worker (concurrency: 3)");
console.log("- Publish worker (concurrency: 1)");
console.log("- RSS poll worker (concurrency: 1)");
console.log("- Discovery worker (concurrency: 1)");
console.log("- Alerts worker (concurrency: 1)");

// Graceful shutdown
process.on("SIGTERM", async () => {
  await Promise.all([
    ingestWorker.close(),
    summarizeWorker.close(),
    publishWorker.close(),
    rssPollWorker.close(),
    discoveryWorker.close(),
    alertsWorker.close(),
  ]);
  await connection.quit();
  process.exit(0);
});
