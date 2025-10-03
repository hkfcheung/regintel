/**
 * Autonomous Discovery Service
 *
 * Uses Raindrop MCP to autonomously search for relevant pediatric oncology documents
 * from configured domains (e.g., FDA, EMA) and queue them for ingestion
 */

import { prisma } from "@regintel/database";

export interface DiscoveryResult {
  domain: string;
  query: string;
  urlsFound: string[];
  urlsQueued: number;
  errors: string[];
}

export class AutonomousDiscoveryService {
  private readonly RAINDROP_API_URL = process.env.RAINDROP_API_URL || "http://localhost:8000";
  private readonly RAINDROP_API_TOKEN = process.env.RAINDROP_API_TOKEN;

  /**
   * Get domains that are due for discovery based on their interval
   */
  async getDomainsDueForDiscovery(): Promise<Array<{ id: string; domain: string; description: string | null }>> {
    const now = new Date();

    const domains = await prisma.allowedDomain.findMany({
      where: { active: true },
      select: {
        id: true,
        domain: true,
        description: true,
        discoveryInterval: true,
        lastDiscoveredAt: true,
      },
    });

    // Filter domains that haven't been discovered or are past their interval
    return domains.filter((domain) => {
      if (!domain.lastDiscoveredAt) {
        return true; // Never discovered, discover now
      }

      const timeSinceLastDiscovery = now.getTime() - domain.lastDiscoveredAt.getTime();
      const intervalMs = domain.discoveryInterval * 1000;

      return timeSinceLastDiscovery >= intervalMs;
    });
  }

  /**
   * Discovery queries for pediatric oncology content
   */
  private readonly DISCOVERY_QUERIES = [
    "pediatric oncology drug approval",
    "pediatric cancer treatment FDA",
    "children oncology drug guidance",
    "pediatric leukemia approval",
    "pediatric solid tumor therapy",
    "adolescent cancer drug",
    "pediatric dose finding oncology",
    "pediatric safety pediatric oncology",
  ];

  /**
   * FDA-specific search patterns
   */
  private readonly FDA_SEARCH_PATHS = [
    "/drugs/resources-information-approved-drugs",
    "/drugs/drug-approvals-and-databases",
    "/regulatory-information/search-fda-guidance-documents",
    "/safety/recalls-market-withdrawals-safety-alerts",
  ];

  /**
   * Run autonomous discovery across all active allowed domains
   */
  async runDiscovery(): Promise<DiscoveryResult[]> {
    console.log("[Discovery] Starting autonomous document discovery...");

    if (!this.RAINDROP_API_TOKEN) {
      console.warn(
        "[Discovery] RAINDROP_API_TOKEN not configured - using basic RSS feed discovery only"
      );
    }

    const allowedDomains = await prisma.allowedDomain.findMany({
      where: { active: true },
    });

    const results: DiscoveryResult[] = [];

    for (const domain of allowedDomains) {
      console.log(`[Discovery] Searching domain: ${domain.domain}`);

      try {
        const result = await this.discoverForDomain(domain.domain);
        results.push(result);

        // Update lastDiscoveredAt timestamp
        await prisma.allowedDomain.update({
          where: { id: domain.id },
          data: { lastDiscoveredAt: new Date() },
        });
      } catch (error) {
        console.error(`[Discovery] Error searching ${domain.domain}:`, error);
        results.push({
          domain: domain.domain,
          query: "N/A",
          urlsFound: [],
          urlsQueued: 0,
          errors: [error instanceof Error ? error.message : String(error)],
        });
      }
    }

    console.log(
      `[Discovery] Completed: ${results.reduce((sum, r) => sum + r.urlsQueued, 0)} URLs queued`
    );

    return results;
  }

  /**
   * Discover documents for a specific domain
   */
  async discoverForDomain(domain: string): Promise<DiscoveryResult> {
    const result: DiscoveryResult = {
      domain,
      query: this.DISCOVERY_QUERIES.join(" OR "),
      urlsFound: [],
      urlsQueued: 0,
      errors: [],
    };

    // Use Raindrop MCP to search for relevant documents
    // We'll use the SmartBucket document-search functionality
    const bucketName = `discovery-${domain.replace(/\./g, "-")}`;

    try {
      // For FDA specifically, we can use targeted searches
      if (domain.includes("fda.gov")) {
        const urls = await this.discoverFdaDocuments();
        result.urlsFound = urls;
      } else {
        // For other domains, use web search
        const urls = await this.discoverGenericDomain(domain);
        result.urlsFound = urls;
      }

      // Queue discovered URLs for ingestion
      for (const url of result.urlsFound) {
        try {
          // Check if already ingested
          const existing = await prisma.sourceItem.findUnique({
            where: { url },
          });

          if (!existing) {
            // Queue for ingestion via the ingest service
            const { IngestService } = await import("./ingest.js");
            const ingestService = new IngestService();

            const ingestResult = await ingestService.ingestUrl({
              url,
              source: `autonomous-discovery-${domain}`,
            });

            if (ingestResult.success) {
              result.urlsQueued++;
            } else {
              result.errors.push(`Failed to ingest ${url}: ${ingestResult.error}`);
            }
          }
        } catch (error) {
          result.errors.push(
            `Error queuing ${url}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    return result;
  }

  /**
   * Discover FDA documents using known patterns
   */
  private async discoverFdaDocuments(): Promise<string[]> {
    const urls: string[] = [];

    // Known FDA RSS feeds for pediatric oncology
    const fdaFeeds = [
      "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/drugs/rss.xml",
      "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/oncology-center-excellence/rss.xml",
    ];

    // Fetch RSS feeds to find recent documents
    const { SourceReaderService } = await import("./sourceReader.js");
    const sourceReader = new SourceReaderService();

    for (const feedUrl of fdaFeeds) {
      try {
        const items = await sourceReader.fetchRssFeed(feedUrl);

        // Filter for pediatric oncology keywords
        const pediatricKeywords = [
          "pediatric",
          "children",
          "adolescent",
          "infant",
          "leukemia",
          "lymphoma",
          "neuroblastoma",
          "sarcoma",
          "brain tumor",
        ];

        for (const item of items) {
          const titleLower = item.title.toLowerCase();
          if (pediatricKeywords.some((keyword) => titleLower.includes(keyword))) {
            urls.push(item.url);
          }
        }
      } catch (error) {
        console.error(`[Discovery] Failed to fetch FDA feed ${feedUrl}:`, error);
      }
    }

    // Also check known FDA approval pages
    const approvalUrls = [
      "https://www.fda.gov/drugs/resources-information-approved-drugs/hematologyoncology-cancer-approvals-safety-notifications",
    ];

    urls.push(...approvalUrls);

    return [...new Set(urls)]; // Deduplicate
  }

  /**
   * Discover documents from generic domain using web search
   * Uses Raindrop MCP for web search if available
   */
  private async discoverGenericDomain(domain: string): Promise<string[]> {
    const urls: string[] = [];

    if (!this.RAINDROP_API_TOKEN) {
      console.log(`[Discovery] Raindrop MCP not configured, skipping web search for ${domain}`);
      return urls;
    }

    console.log(`[Discovery] Searching ${domain} using Raindrop MCP`);

    // Perform site-specific searches for pediatric oncology content
    for (const query of this.DISCOVERY_QUERIES.slice(0, 3)) { // Limit queries to avoid rate limits
      try {
        const searchQuery = `site:${domain} ${query}`;
        console.log(`[Discovery] Query: ${searchQuery}`);

        // Call Raindrop MCP web search
        const response = await fetch(`${this.RAINDROP_API_URL}/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.RAINDROP_API_TOKEN}`,
          },
          body: JSON.stringify({
            query: searchQuery,
            limit: 10,
          }),
        });

        if (!response.ok) {
          console.warn(`[Discovery] Raindrop search failed for ${searchQuery}: ${response.status}`);
          continue;
        }

        const data = await response.json();

        // Extract URLs from search results
        if (data.results && Array.isArray(data.results)) {
          for (const result of data.results) {
            if (result.url && result.url.includes(domain)) {
              urls.push(result.url);
            }
          }
        }
      } catch (error) {
        console.error(`[Discovery] Error searching ${domain}:`, error);
      }
    }

    return [...new Set(urls)]; // Deduplicate
  }

  /**
   * Store discovered URLs in a SmartBucket for tracking
   */
  private async storeInSmartBucket(
    bucketName: string,
    urls: string[],
    metadata: any
  ): Promise<void> {
    // This would use Raindrop MCP's SmartBucket functionality
    // to store discovered URLs with metadata for tracking

    console.log(`[Discovery] Would store ${urls.length} URLs in bucket ${bucketName}`);

    // Implementation would call Raindrop MCP API:
    // - Create bucket if doesn't exist
    // - Store URLs with metadata (discovery date, query, etc.)
    // - Use for deduplication and tracking
  }
}
