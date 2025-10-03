/**
 * RSS Polling Service
 *
 * Polls configured RSS feeds for new regulatory announcements
 * and triggers ingestion for relevant items
 */

import { prisma } from "@regintel/database";
import { SourceReaderService } from "./sourceReader.js";
import { IngestService } from "./ingest.js";

export interface PollResult {
  feedId: string;
  feedUrl: string;
  itemsFound: number;
  itemsIngested: number;
  errors: string[];
}

export class RssPollService {
  private sourceReader: SourceReaderService;
  private ingest: IngestService;

  constructor() {
    this.sourceReader = new SourceReaderService();
    this.ingest = new IngestService();
  }

  /**
   * Poll all active RSS feeds
   */
  async pollAllFeeds(): Promise<PollResult[]> {
    const feeds = await prisma.rssFeed.findMany({
      where: { active: true },
    });

    console.log(`[RSS Poll] Polling ${feeds.length} active feeds...`);

    const results: PollResult[] = [];

    for (const feed of feeds) {
      try {
        const result = await this.pollFeed(feed.id);
        results.push(result);

        // Update last polled timestamp
        await prisma.rssFeed.update({
          where: { id: feed.id },
          data: { lastPolledAt: new Date() },
        });
      } catch (error) {
        console.error(`[RSS Poll] Failed to poll feed ${feed.id}:`, error);
        results.push({
          feedId: feed.id,
          feedUrl: feed.url,
          itemsFound: 0,
          itemsIngested: 0,
          errors: [error instanceof Error ? error.message : String(error)],
        });
      }
    }

    return results;
  }

  /**
   * Poll a specific RSS feed by ID
   */
  async pollFeed(feedId: string): Promise<PollResult> {
    const feed = await prisma.rssFeed.findUnique({
      where: { id: feedId },
    });

    if (!feed) {
      throw new Error(`RSS feed not found: ${feedId}`);
    }

    console.log(`[RSS Poll] Polling feed: ${feed.title} (${feed.url})`);

    const result: PollResult = {
      feedId: feed.id,
      feedUrl: feed.url,
      itemsFound: 0,
      itemsIngested: 0,
      errors: [],
    };

    try {
      // Fetch RSS feed items
      const items = await this.sourceReader.fetchRssFeed(feed.url);
      result.itemsFound = items.length;

      console.log(`[RSS Poll] Found ${items.length} items in feed`);

      // Process each item
      for (const item of items) {
        try {
          // Check if already ingested
          const existing = await prisma.sourceItem.findUnique({
            where: { url: item.url },
          });

          if (existing) {
            console.log(`[RSS Poll] Skipping duplicate: ${item.url}`);
            continue;
          }

          // Check if URL is from allowed domain
          if (!(await this.sourceReader.isAllowedSource(item.url))) {
            console.log(`[RSS Poll] Skipping non-allowed domain: ${item.url}`);
            continue;
          }

          // Ingest the item
          console.log(`[RSS Poll] Ingesting: ${item.title}`);
          const ingestResult = await this.ingest.ingestUrl({
            url: item.url,
            source: feed.title,
          });

          if (ingestResult.success) {
            result.itemsIngested++;
          } else {
            result.errors.push(`Failed to ingest ${item.url}: ${ingestResult.error}`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`[RSS Poll] Error processing item ${item.url}:`, errorMsg);
          result.errors.push(`Error processing ${item.url}: ${errorMsg}`);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to fetch feed: ${errorMsg}`);
      throw error;
    }

    console.log(
      `[RSS Poll] Completed: ${result.itemsIngested}/${result.itemsFound} items ingested`
    );

    return result;
  }

  /**
   * Check which feeds are due for polling based on their poll interval
   */
  async getFeedsDueForPolling(): Promise<Array<{ id: string; url: string; title: string }>> {
    const now = new Date();

    const feeds = await prisma.rssFeed.findMany({
      where: {
        active: true,
      },
      select: {
        id: true,
        url: true,
        title: true,
        pollInterval: true,
        lastPolledAt: true,
      },
    });

    // Filter feeds that haven't been polled or are past their interval
    return feeds.filter((feed) => {
      if (!feed.lastPolledAt) {
        return true; // Never polled, poll now
      }

      const timeSinceLastPoll = now.getTime() - feed.lastPolledAt.getTime();
      const intervalMs = feed.pollInterval * 1000; // Convert seconds to milliseconds

      return timeSinceLastPoll >= intervalMs;
    });
  }
}
