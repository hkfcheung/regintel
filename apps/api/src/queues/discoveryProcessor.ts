/**
 * Discovery Queue Processor
 *
 * Processes scheduled autonomous discovery jobs
 */

import { Job } from "bullmq";
import { AutonomousDiscoveryService, DiscoveryResult } from "../services/autonomousDiscovery.js";

export interface DiscoveryJobData {
  domain?: string; // If specified, discover only for this domain
}

export interface DiscoveryJobResult {
  results: DiscoveryResult[];
  totalUrlsFound: number;
  totalUrlsQueued: number;
  totalErrors: number;
}

export async function processDiscoveryJob(
  job: Job<DiscoveryJobData>
): Promise<DiscoveryJobResult> {
  const { domain } = job.data;

  console.log(`[DiscoveryWorker] Processing discovery job ${job.id}`);

  const discoveryService = new AutonomousDiscoveryService();
  let results: DiscoveryResult[];

  if (domain) {
    // Discover for specific domain
    console.log(`[DiscoveryWorker] Running discovery for domain: ${domain}`);
    const result = await discoveryService.discoverForDomain(domain);
    results = [result];
  } else {
    // Discover across all active domains
    console.log(`[DiscoveryWorker] Running discovery for all active domains`);
    results = await discoveryService.runDiscovery();
  }

  const totalUrlsFound = results.reduce((sum, r) => sum + r.urlsFound.length, 0);
  const totalUrlsQueued = results.reduce((sum, r) => sum + r.urlsQueued, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  console.log(
    `[DiscoveryWorker] Completed: ${totalUrlsQueued}/${totalUrlsFound} URLs queued for ingestion`
  );

  return {
    results,
    totalUrlsFound,
    totalUrlsQueued,
    totalErrors,
  };
}
