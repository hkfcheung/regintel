/**
 * Source Reader Service
 *
 * Fetches and parses content from regulatory sources (FDA, etc.)
 * Extracts text from HTML and PDF documents
 */

import * as cheerio from "cheerio";
import crypto from "crypto";
import { prisma } from "@regintel/database";

interface FetchedContent {
  url: string;
  title: string;
  html?: string;
  text: string;
  canonicalPdfUrl?: string;
  publishedAt?: Date;
  contentHash: string;
}

interface FetchOptions {
  followRedirects?: boolean;
  timeout?: number;
  userAgent?: string;
}

export class SourceReaderService {
  private readonly DEFAULT_USER_AGENT =
    "RegIntel/1.0 (Regulatory Intelligence Bot; +https://regintel.example.com)";
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

  /**
   * Fetch and parse content from a URL
   */
  async fetchContent(
    url: string,
    options: FetchOptions = {}
  ): Promise<FetchedContent> {
    const {
      followRedirects = true,
      timeout = this.DEFAULT_TIMEOUT,
      userAgent = this.DEFAULT_USER_AGENT,
    } = options;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        headers: {
          "User-Agent": userAgent,
          Accept: "text/html,application/pdf,application/xhtml+xml",
        },
        redirect: followRedirects ? "follow" : "manual",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} for ${url}`
        );
      }

      const contentType = response.headers.get("content-type") || "";

      // Handle PDF files
      if (contentType.includes("application/pdf")) {
        return await this.parsePdfResponse(url, response);
      }

      // Handle HTML
      if (contentType.includes("text/html")) {
        const html = await response.text();
        return await this.parseHtmlContent(url, html);
      }

      throw new Error(`Unsupported content type: ${contentType}`);
    } catch (error: any) {
      if (error.name === "AbortError") {
        throw new Error(`Request timeout after ${timeout}ms for ${url}`);
      }
      throw error;
    }
  }

  /**
   * Parse HTML content and extract text
   */
  private async parseHtmlContent(
    url: string,
    html: string
  ): Promise<FetchedContent> {
    const $ = cheerio.load(html);

    // Extract title
    const title =
      $("title").text().trim() ||
      $("h1").first().text().trim() ||
      "Untitled Document";

    // Look for canonical PDF link
    let canonicalPdfUrl: string | undefined;
    $('a[href$=".pdf"]').each((_, elem) => {
      const href = $(elem).attr("href");
      if (href) {
        canonicalPdfUrl = new URL(href, url).href;
        return false; // break
      }
    });

    // Extract published date (common FDA patterns)
    let publishedAt: Date | undefined;
    const datePatterns = [
      $('meta[name="published"]').attr("content"),
      $('meta[name="DC.date"]').attr("content"),
      $('time[datetime]').attr("datetime"),
      $(".publication-date").text(),
      $(".date-display-single").text(),
    ];

    for (const dateStr of datePatterns) {
      if (dateStr) {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          publishedAt = parsed;
          break;
        }
      }
    }

    // Extract main content text
    // Remove scripts, styles, nav, footer
    $("script, style, nav, footer, header, aside").remove();

    // Try to find main content area
    const mainContent =
      $("main").text() ||
      $('article').text() ||
      $('[role="main"]').text() ||
      $("#content").text() ||
      $(".content").text() ||
      $("body").text();

    // Clean and normalize whitespace
    const text = mainContent
      .replace(/\s+/g, " ")
      .replace(/\n\s*\n/g, "\n")
      .trim();

    // Generate content hash
    const contentHash = this.generateContentHash(text);

    return {
      url,
      title,
      html,
      text,
      canonicalPdfUrl,
      publishedAt,
      contentHash,
    };
  }

  /**
   * Parse PDF response
   * Note: For MVP, we'll fetch the PDF but delegate actual PDF text extraction
   * to a separate service (like pdf-parse or external API)
   */
  private async parsePdfResponse(
    url: string,
    response: Response
  ): Promise<FetchedContent> {
    // For now, we'll store the PDF URL and return minimal metadata
    // PDF text extraction will be added in the next phase
    const buffer = await response.arrayBuffer();
    const text = `[PDF Document: ${url}]\n\nPDF text extraction not yet implemented. Use external service.`;

    // Try to extract title from URL
    const urlParts = url.split("/");
    const filename = urlParts[urlParts.length - 1];
    const title = filename.replace(".pdf", "").replace(/[-_]/g, " ");

    const contentHash = this.generateContentHash(new Uint8Array(buffer));

    return {
      url,
      title,
      text,
      canonicalPdfUrl: url,
      contentHash,
    };
  }

  /**
   * Generate SHA-256 hash of content for deduplication
   */
  private generateContentHash(
    content: string | Uint8Array
  ): string {
    const hash = crypto.createHash("sha256");
    hash.update(content);
    return hash.digest("hex");
  }

  /**
   * Fetch RSS feed and extract item URLs
   * Used for scheduled batch ingestion
   */
  async fetchRssFeed(feedUrl: string): Promise<Array<{
    url: string;
    title: string;
    publishedAt?: Date;
  }>> {
    try {
      const response = await fetch(feedUrl, {
        headers: {
          "User-Agent": this.DEFAULT_USER_AGENT,
          Accept: "application/rss+xml, application/xml, text/xml",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for RSS feed ${feedUrl}`);
      }

      const xml = await response.text();
      const $ = cheerio.load(xml, { xmlMode: true });

      const items: Array<{ url: string; title: string; publishedAt?: Date }> =
        [];

      $("item").each((_, elem) => {
        const $item = $(elem);
        const url = $item.find("link").text().trim();
        const title = $item.find("title").text().trim();
        const pubDateStr = $item.find("pubDate").text().trim();

        if (url && title) {
          const publishedAt = pubDateStr ? new Date(pubDateStr) : undefined;
          items.push({ url, title, publishedAt });
        }
      });

      return items;
    } catch (error) {
      console.error(`Failed to fetch RSS feed ${feedUrl}:`, error);
      throw error;
    }
  }

  /**
   * Check if URL is from an allowed source domain
   * Implements allowlist-based security using database configuration
   */
  async isAllowedSource(url: string): Promise<boolean> {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // Fetch active allowed domains from database
      const allowedDomains = await prisma.allowedDomain.findMany({
        where: { active: true },
        select: { domain: true },
      });

      return allowedDomains.some(({ domain }) => {
        const lowerDomain = domain.toLowerCase();
        return hostname === lowerDomain || hostname.endsWith(`.${lowerDomain}`);
      });
    } catch {
      return false;
    }
  }

  /**
   * Truncate text to a maximum length (for LLM context limits)
   */
  truncateText(text: string, maxLength: number = 10000): string {
    if (text.length <= maxLength) {
      return text;
    }

    return text.substring(0, maxLength) + "\n\n[... truncated ...]";
  }
}
