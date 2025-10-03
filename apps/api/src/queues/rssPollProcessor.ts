/**
 * RSS Poll Queue Processor
 *
 * Processes scheduled RSS polling jobs
 */

import { Job } from "bullmq";
import { RssPollService, PollResult } from "../services/rssPollService.js";

export interface RssPollJobData {
  feedId?: string; // If specified, poll only this feed
}

export interface RssPollJobResult {
  results: PollResult[];
  totalItemsFound: number;
  totalItemsIngested: number;
}

export async function processRssPollJob(
  job: Job<RssPollJobData>
): Promise<RssPollJobResult> {
  const { feedId } = job.data;

  console.log(`[RssPollWorker] Processing RSS poll job ${job.id}`);

  const pollService = new RssPollService();
  let results: PollResult[];

  if (feedId) {
    // Poll specific feed
    console.log(`[RssPollWorker] Polling single feed: ${feedId}`);
    const result = await pollService.pollFeed(feedId);
    results = [result];
  } else {
    // Poll all active feeds
    console.log(`[RssPollWorker] Polling all active feeds`);
    results = await pollService.pollAllFeeds();
  }

  const totalItemsFound = results.reduce((sum, r) => sum + r.itemsFound, 0);
  const totalItemsIngested = results.reduce((sum, r) => sum + r.itemsIngested, 0);

  console.log(
    `[RssPollWorker] Completed: ${totalItemsIngested}/${totalItemsFound} items ingested from ${results.length} feeds`
  );

  return {
    results,
    totalItemsFound,
    totalItemsIngested,
  };
}
