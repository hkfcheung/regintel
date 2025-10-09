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
    // Get feeds that are due for polling
    const feedsDue = await pollService.getFeedsDueForPolling();
    console.log(`[RssPollWorker] Found ${feedsDue.length} feeds due for polling`);

    results = [];
    for (const feed of feedsDue) {
      try {
        console.log(`[RssPollWorker] Polling: ${feed.title}`);
        const result = await pollService.pollFeed(feed.id);
        results.push(result);

        // Update lastPolledAt timestamp
        const { prisma } = await import("@regintel/database");
        await prisma.rssFeed.update({
          where: { id: feed.id },
          data: { lastPolledAt: new Date() },
        });
        console.log(`[RssPollWorker] Updated lastPolledAt for ${feed.title}`);
      } catch (error) {
        console.error(`[RssPollWorker] Failed to poll feed ${feed.id}:`, error);
        results.push({
          feedId: feed.id,
          feedUrl: feed.url,
          itemsFound: 0,
          itemsIngested: 0,
          errors: [error instanceof Error ? error.message : String(error)],
        });
      }
    }
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
