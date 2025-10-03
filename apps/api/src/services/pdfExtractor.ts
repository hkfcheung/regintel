/**
 * PDF Text Extraction Service
 *
 * Extracts text content from PDF files
 * NOTE: pdf-parse has ESM compatibility issues in Node.js
 * This service is currently disabled and will fall back to HTML extraction
 */

export interface PdfExtractionResult {
  text: string;
  numPages: number;
  metadata?: {
    Title?: string;
    Author?: string;
    Subject?: string;
    Creator?: string;
    Producer?: string;
    CreationDate?: Date;
  };
}

export class PdfExtractorService {
  /**
   * Extract text from PDF buffer
   */
  async extractFromBuffer(buffer: Buffer): Promise<PdfExtractionResult> {
    // PDF extraction is currently disabled due to pdf-parse ESM compatibility issues
    throw new Error("PDF extraction not available - please use HTML text extraction instead");
  }

  /**
   * Extract text from PDF URL
   */
  async extractFromUrl(url: string): Promise<PdfExtractionResult> {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "RegIntel/1.0 (Regulatory Intelligence Bot; +https://regintel.example.com)",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return await this.extractFromBuffer(buffer);
    } catch (error) {
      console.error(`Failed to extract PDF from URL ${url}:`, error);
      throw error;
    }
  }

  /**
   * Clean and normalize extracted PDF text
   * Removes excessive whitespace and artifacts
   */
  cleanText(text: string): string {
    return (
      text
        // Remove form feed characters
        .replace(/\f/g, "\n")
        // Normalize multiple spaces
        .replace(/ {2,}/g, " ")
        // Normalize multiple newlines
        .replace(/\n{3,}/g, "\n\n")
        // Remove leading/trailing whitespace from each line
        .split("\n")
        .map((line) => line.trim())
        .join("\n")
        .trim()
    );
  }

  /**
   * Extract text from specific page range
   */
  async extractPages(
    buffer: Buffer,
    startPage: number,
    endPage: number
  ): Promise<string> {
    // PDF extraction is currently disabled due to pdf-parse ESM compatibility issues
    throw new Error("PDF extraction not available - please use HTML text extraction instead");
  }
}
