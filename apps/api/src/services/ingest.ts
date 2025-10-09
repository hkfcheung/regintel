/**
 * Ingest Service - Fetch and parse regulatory content
 */

import { prisma } from "@regintel/database";
import { extractDomain, getISOWeek } from "@regintel/shared";
import { RaindropService } from "./raindrop.js";
import { SourceReaderService } from "./sourceReader.js";
import { PdfExtractorService } from "./pdfExtractor.js";

interface IngestResult {
  success: boolean;
  sourceItemId?: string;
  error?: string;
  duplicate?: boolean;
}

export class IngestService {
  private raindrop: RaindropService;
  private sourceReader: SourceReaderService;
  private pdfExtractor: PdfExtractorService;

  constructor() {
    this.raindrop = new RaindropService();
    this.sourceReader = new SourceReaderService();
    this.pdfExtractor = new PdfExtractorService();
  }

  /**
   * Main ingest method - fetch URL and store in database
   */
  async ingestUrl(params: {
    url: string;
    source?: string;
    type?: string;
    rssFeedId?: string;
  }): Promise<IngestResult> {
    try {
      const { url, source, type, rssFeedId } = params;

      // 1. Validate source domain
      if (!(await this.sourceReader.isAllowedSource(url))) {
        return {
          success: false,
          error: `Domain not in allowlist: ${extractDomain(url)}`,
        };
      }

      console.log(`[Ingest] Fetching URL: ${url}`);

      // 2. Fetch and parse content using enhanced SourceReaderService
      const fetchedContent = await this.sourceReader.fetchContent(url);

      // 3. Check for duplicates
      const existing = await prisma.sourceItem.findUnique({
        where: { contentHash: fetchedContent.contentHash },
      });

      if (existing) {
        console.log(`[Ingest] Duplicate found: ${existing.id}`);
        return {
          success: true,
          sourceItemId: existing.id,
          duplicate: true,
        };
      }

      // 4. Extract PDF text if available
      let extractedText = fetchedContent.text;
      if (fetchedContent.canonicalPdfUrl) {
        try {
          console.log(`[Ingest] Extracting PDF: ${fetchedContent.canonicalPdfUrl}`);
          const pdfResult = await this.pdfExtractor.extractFromUrl(
            fetchedContent.canonicalPdfUrl
          );
          extractedText = this.pdfExtractor.cleanText(pdfResult.text);

          // Use PDF metadata if available
          if (pdfResult.metadata?.Title && pdfResult.metadata.Title !== 'Untitled') {
            fetchedContent.title = pdfResult.metadata.Title;
          }
        } catch (error) {
          console.warn(`[Ingest] PDF extraction failed, using HTML text:`, error);
        }
      }

      // 5. Determine source type
      const inferredType = type || this.inferSourceType(url, fetchedContent.title);
      const inferredSource = source || this.inferSource(url);

      // 6. Store in database
      const sourceItem = await prisma.sourceItem.create({
        data: {
          url,
          canonicalPdfUrl: fetchedContent.canonicalPdfUrl,
          sourceDomain: extractDomain(url),
          type: inferredType.toUpperCase() as any,
          title: fetchedContent.title,
          publishedAt: fetchedContent.publishedAt,
          contentHash: fetchedContent.contentHash,
          status: "INTAKE",
          rssFeedId: rssFeedId || null,
          tags: JSON.stringify([
            `source:${inferredSource}`,
            `type:${inferredType}`,
            `week:${getISOWeek(new Date())}`,
            `status:intake`,
          ]),
        },
      });

      console.log(`[Ingest] Created source item: ${sourceItem.id}`);

      // 7. Queue analysis job (async, non-blocking)
      this.queueAnalysisJob(sourceItem.id).catch((error) => {
        console.warn("[Ingest] Failed to queue analysis job (non-blocking):", error);
      });

      // 8. Create Raindrop bookmark (if configured)
      const truncatedText = this.sourceReader.truncateText(extractedText, 500);
      const raindropBookmark = await this.raindrop.createBookmark({
        url,
        title: fetchedContent.title,
        excerpt: truncatedText,
        collection: "intake",
        tags: RaindropService.buildTags({
          source: inferredSource,
          type: inferredType,
          week: getISOWeek(new Date()),
          status: "intake",
        }),
      });

      if (raindropBookmark) {
        await prisma.sourceItem.update({
          where: { id: sourceItem.id },
          data: { raindropId: raindropBookmark.id },
        });
      }

      return {
        success: true,
        sourceItemId: sourceItem.id,
      };
    } catch (error) {
      console.error("[Ingest] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Extract title from HTML or generate from URL
   */
  private extractTitle(html: string, url: string): string {
    // Try <title> tag
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim().replace(/\s+/g, " ").substring(0, 500);
    }

    // Try <h1> tag
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
    if (h1Match && h1Match[1]) {
      return h1Match[1]
        .replace(/<[^>]*>/g, "")
        .trim()
        .substring(0, 500);
    }

    // Fallback to URL
    const path = new URL(url).pathname;
    return path.split("/").filter(Boolean).pop() || "Untitled Document";
  }

  /**
   * Extract published date from HTML metadata
   */
  private extractPublishDate(html: string): Date | null {
    // Try meta tags
    const datePatterns = [
      /<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*name=["']date["'][^>]*content=["']([^"']+)["']/i,
      /<time[^>]*datetime=["']([^"']+)["']/i,
    ];

    for (const pattern of datePatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const date = new Date(match[1]);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return null;
  }

  /**
   * Extract PDF URL from HTML
   */
  private extractPdfUrl(html: string, baseUrl: string): string | null {
    // Look for PDF links
    const pdfMatch = html.match(/<a[^>]*href=["']([^"']*\.pdf[^"']*)["']/i);
    if (pdfMatch && pdfMatch[1]) {
      const pdfUrl = pdfMatch[1];
      // Make absolute if relative
      if (pdfUrl.startsWith("http")) {
        return pdfUrl;
      } else {
        const base = new URL(baseUrl);
        return new URL(pdfUrl, base.origin).href;
      }
    }

    return null;
  }

  /**
   * Infer source type from URL and title
   */
  private inferSourceType(url: string, title: string): string {
    const urlLower = url.toLowerCase();
    const titleLower = title.toLowerCase();

    if (urlLower.includes("guidance") || titleLower.includes("guidance")) {
      return "guidance";
    }
    if (
      urlLower.includes("warning-letter") ||
      urlLower.includes("warningletters") ||
      titleLower.includes("warning letter")
    ) {
      return "warning_letter";
    }
    if (urlLower.includes("untitled-letter") || titleLower.includes("untitled letter")) {
      return "untitled_letter";
    }
    if (urlLower.includes("meeting") || titleLower.includes("meeting")) {
      return "meeting";
    }
    if (urlLower.includes("approval") || titleLower.includes("approval")) {
      return "approval";
    }

    return "press";
  }

  /**
   * Infer source from domain
   */
  private inferSource(url: string): string {
    const domain = extractDomain(url);

    if (domain.includes("fda.gov")) {
      return "fda";
    }

    return domain.replace(/^www\./, "");
  }

  /**
   * Queue analysis job for source item
   * This is called after ingestion to automatically analyze content
   */
  private async queueAnalysisJob(sourceItemId: string): Promise<void> {
    try {
      const { Queue } = await import("bullmq");
      const { default: IORedis } = await import("ioredis");

      const connection = new IORedis({
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        maxRetriesPerRequest: null,
      });

      const summarizeQueue = new Queue("summarize", { connection });

      await summarizeQueue.add(
        "analyze-source",
        { sourceItemId },
        {
          jobId: `analyze-${sourceItemId}`,
          removeOnComplete: 100,
          removeOnFail: 1000,
          attempts: 2,
          backoff: {
            type: "exponential",
            delay: 10000,
          },
        }
      );

      console.log(`[Ingest] Queued analysis job for source item: ${sourceItemId}`);

      await connection.quit();
    } catch (error) {
      console.error("[Ingest] Failed to queue analysis job:", error);
      throw error;
    }
  }
}
