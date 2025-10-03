/**
 * Ingest Job Processor
 *
 * Processes ingest jobs from the BullMQ queue
 * 1. Fetch content from URL
 * 2. Extract text (HTML or PDF)
 * 3. Check for duplicates
 * 4. Save to database
 * 5. Create Raindrop bookmark
 */

import { Job } from "bullmq";
import { PrismaClient } from "@regintel/database";
import { SourceReaderService } from "../services/sourceReader.js";
import { PdfExtractorService } from "../services/pdfExtractor.js";
import { RaindropService } from "../services/raindrop.js";

const prisma = new PrismaClient();
const sourceReader = new SourceReaderService();
const pdfExtractor = new PdfExtractorService();
const raindrop = new RaindropService();

interface IngestJobData {
  url: string;
  source?: string;
  type?:
    | "guidance"
    | "warning_letter"
    | "untitled_letter"
    | "meeting"
    | "approval"
    | "press";
}

interface IngestJobResult {
  sourceItemId?: string;
  raindropId?: string;
  status: "created" | "duplicate" | "failed";
  error?: string;
}

export async function processIngestJob(
  job: Job<IngestJobData>
): Promise<IngestJobResult> {
  const { url, source, type } = job.data;

  try {
    // Step 1: Validate URL is from allowed source
    await job.updateProgress(10);
    if (!sourceReader.isAllowedSource(url)) {
      throw new Error(
        `URL not from allowed source domain: ${url}`
      );
    }

    // Step 2: Fetch and parse content
    await job.updateProgress(20);
    const fetchedContent = await sourceReader.fetchContent(url);

    // Step 3: Check for duplicates by content hash
    await job.updateProgress(30);
    const existingItem = await prisma.sourceItem.findUnique({
      where: { contentHash: fetchedContent.contentHash },
    });

    if (existingItem) {
      return {
        sourceItemId: existingItem.id,
        status: "duplicate",
      };
    }

    // Step 4: If PDF, extract text
    await job.updateProgress(40);
    let extractedText = fetchedContent.text;
    if (fetchedContent.canonicalPdfUrl) {
      try {
        const pdfResult = await pdfExtractor.extractFromUrl(
          fetchedContent.canonicalPdfUrl
        );
        extractedText = pdfExtractor.cleanText(pdfResult.text);

        // Update title if PDF metadata has better info
        if (pdfResult.metadata?.Title) {
          fetchedContent.title = pdfResult.metadata.Title;
        }
      } catch (error) {
        console.warn(
          `PDF extraction failed for ${fetchedContent.canonicalPdfUrl}:`,
          error
        );
        // Continue with HTML text if PDF extraction fails
      }
    }

    // Step 5: Determine source domain and type
    await job.updateProgress(50);
    const urlObj = new URL(url);
    const sourceDomain = urlObj.hostname;

    // Infer type from URL or metadata if not provided
    const inferredType = type || inferSourceType(url, fetchedContent.title);

    // Step 6: Save to database
    await job.updateProgress(60);
    const sourceItem = await prisma.sourceItem.create({
      data: {
        url,
        canonicalPdfUrl: fetchedContent.canonicalPdfUrl,
        sourceDomain,
        type: inferredType.toUpperCase() as any,
        title: fetchedContent.title,
        publishedAt: fetchedContent.publishedAt,
        contentHash: fetchedContent.contentHash,
        status: "INTAKE",
        tags: [],
      },
    });

    // Step 7: Create Raindrop bookmark (optional, non-blocking)
    await job.updateProgress(80);
    let raindropId: string | undefined;
    try {
      const week = getISOWeek(new Date());
      const tags = RaindropService.buildTags({
        source: source || sourceDomain,
        type: inferredType,
        week,
        status: "intake",
      });

      const bookmark = await raindrop.createBookmark({
        url,
        title: fetchedContent.title,
        excerpt: sourceReader.truncateText(extractedText, 500),
        collection: "intake",
        tags,
      });

      if (bookmark) {
        raindropId = bookmark.id;
        // Update source item with Raindrop ID
        await prisma.sourceItem.update({
          where: { id: sourceItem.id },
          data: { raindropId: bookmark.id },
        });
      }
    } catch (error) {
      console.warn("Raindrop bookmark creation failed (non-blocking):", error);
    }

    await job.updateProgress(100);

    return {
      sourceItemId: sourceItem.id,
      raindropId,
      status: "created",
    };
  } catch (error: any) {
    console.error(`Ingest job failed for ${url}:`, error);
    return {
      status: "failed",
      error: error.message || String(error),
    };
  }
}

/**
 * Infer source type from URL patterns and title
 */
function inferSourceType(url: string, title: string): string {
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title.toLowerCase();

  if (
    lowerUrl.includes("/guidance/") ||
    lowerTitle.includes("guidance")
  ) {
    return "guidance";
  }

  if (
    lowerUrl.includes("warning-letter") ||
    lowerUrl.includes("warningletters") ||
    lowerTitle.includes("warning letter")
  ) {
    return "warning_letter";
  }

  if (
    lowerUrl.includes("untitled-letter") ||
    lowerTitle.includes("untitled letter")
  ) {
    return "untitled_letter";
  }

  if (
    lowerUrl.includes("/meeting") ||
    lowerTitle.includes("meeting")
  ) {
    return "meeting";
  }

  if (
    lowerUrl.includes("/approval") ||
    lowerTitle.includes("approval")
  ) {
    return "approval";
  }

  if (
    lowerUrl.includes("/press") ||
    lowerTitle.includes("press release")
  ) {
    return "press";
  }

  // Default fallback
  return "guidance";
}

/**
 * Get ISO week number (YYYY-WW format)
 */
function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getFullYear()}-${String(weekNo).padStart(2, "0")}`;
}
