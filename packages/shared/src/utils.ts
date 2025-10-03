// Shared utility functions

import { createHash } from "crypto";

/**
 * Generate a deterministic hash for content de-duplication
 */
export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Get ISO week number (YYYY-WW format) for a given date
 */
export function getISOWeek(date: Date): string {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-${String(weekNo).padStart(2, "0")}`;
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return "unknown";
  }
}

/**
 * Validate if URL is in allowlist
 * TODO: Move allowlist to database configuration
 */
export function isAllowedSource(url: string): boolean {
  const ALLOWED_DOMAINS = [
    "fda.gov",
    "www.fda.gov",
    // Add more as needed
  ];

  const domain = extractDomain(url);
  return ALLOWED_DOMAINS.some((allowed) => domain.endsWith(allowed));
}

/**
 * Sanitize text for storage (remove excessive whitespace)
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 50000); // Limit to 50k chars
}
