/**
 * Analysis Service - LLM-based content analysis for pediatric oncology
 *
 * Uses OpenAI/Anthropic to analyze regulatory documents and extract
 * pediatric oncology-specific insights
 */

import { prisma } from "@regintel/database";
import {
  SUMMARIZE_SYSTEM_PROMPT,
  buildSummarizeUserPrompt,
  SELF_CHECK_SYSTEM_PROMPT,
  buildSelfCheckUserPrompt,
} from "@regintel/shared";

interface AnalysisResult {
  pediatric_relevant: boolean;
  classification: "Approval" | "Guidance" | "Safety Alert" | "Other" | null;
  summary_md: string;
  impact_md: string;
  pediatric_details: {
    age_groups: string[];
    dosing: string | null;
    safety_outcomes: string | null;
    efficacy_data: string | null;
  };
  citations: Array<{
    url: string;
    locator: string;
    quote?: string;
  }>;
  needs_more_context: boolean;
}

interface ValidationResult {
  corrected_summary_md: string;
  corrected_impact_md: string;
  corrected_citations: Array<{
    url: string;
    locator: string;
    quote?: string;
  }>;
  validation: {
    passed: boolean;
    notes: string[];
  };
}

export class AnalysisService {
  private apiKey: string;
  private apiProvider: "openai" | "anthropic";
  private model: string;

  constructor() {
    // Prioritize OpenAI over Anthropic
    if (process.env.OPENAI_API_KEY) {
      this.apiProvider = "openai";
      this.apiKey = process.env.OPENAI_API_KEY;
      this.model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      console.log(`[Analysis] Using OpenAI (${this.model})`);
    } else if (process.env.ANTHROPIC_API_KEY) {
      this.apiProvider = "anthropic";
      this.apiKey = process.env.ANTHROPIC_API_KEY;
      this.model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";
      console.log(`[Analysis] Using Anthropic (${this.model})`);
    } else {
      this.apiProvider = "openai";
      this.apiKey = "";
      this.model = "gpt-4o-mini";
      console.warn("⚠️  No LLM API key found - analysis will be skipped");
    }
  }

  /**
   * Analyze a source item and create an Analysis record
   */
  async analyzeSourceItem(sourceItemId: string): Promise<{
    success: boolean;
    analysisId?: string;
    error?: string;
  }> {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          error: "No LLM API key configured",
        };
      }

      // Fetch source item with extracted text
      const sourceItem = await prisma.sourceItem.findUnique({
        where: { id: sourceItemId },
      });

      if (!sourceItem) {
        return {
          success: false,
          error: "Source item not found",
        };
      }

      console.log(`[Analysis] Analyzing source item: ${sourceItem.id}`);

      // For this MVP, we'll need to re-fetch the content to get extracted text
      // In production, you'd store extracted text in the database
      const { SourceReaderService } = await import("./sourceReader.js");
      const sourceReader = new SourceReaderService();

      let extractedText = "";

      try {
        const content = await sourceReader.fetchContent(sourceItem.url);
        extractedText = content.text;

        // Try PDF extraction if available (optional, may fail due to pdf-parse module issues)
        if (content.canonicalPdfUrl) {
          try {
            // Dynamic import to handle potential module errors gracefully
            const { PdfExtractorService } = await import("./pdfExtractor.js");
            const pdfExtractor = new PdfExtractorService();
            const pdfResult = await pdfExtractor.extractFromUrl(content.canonicalPdfUrl);
            extractedText = pdfExtractor.cleanText(pdfResult.text);
            console.log("[Analysis] Successfully extracted PDF text");
          } catch (pdfError) {
            console.warn("[Analysis] PDF extraction failed, using HTML text:", pdfError instanceof Error ? pdfError.message : String(pdfError));
          }
        }
      } catch (fetchError) {
        return {
          success: false,
          error: `Failed to fetch content: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
        };
      }

      // Truncate for LLM context limits
      const truncatedText = sourceReader.truncateText(extractedText, 12000);

      // Step 1: Initial analysis
      console.log(`[Analysis] Calling LLM for analysis...`);
      const analysisResult = await this.callLLM<AnalysisResult>(
        SUMMARIZE_SYSTEM_PROMPT,
        buildSummarizeUserPrompt({
          title: sourceItem.title,
          url: sourceItem.url,
          pdfUrl: sourceItem.canonicalPdfUrl || undefined,
          extractedText: truncatedText,
        })
      );

      // If not pediatric relevant, skip further processing
      if (!analysisResult.pediatric_relevant) {
        console.log(`[Analysis] Document not relevant to pediatric oncology, skipping`);

        // Still create an analysis record to mark as reviewed
        const analysis = await prisma.analysis.create({
          data: {
            sourceItemId: sourceItem.id,
            summaryMd: analysisResult.summary_md,
            impactMd: "Not applicable - document not relevant to pediatric oncology",
            citations: JSON.stringify([]),
            modelMeta: JSON.stringify({
              provider: this.apiProvider,
              model: this.model,
              pediatric_relevant: false,
              timestamp: new Date().toISOString(),
            }),
          },
        });

        // Update source item status
        await prisma.sourceItem.update({
          where: { id: sourceItem.id },
          data: { status: "REJECTED" },
        });

        return {
          success: true,
          analysisId: analysis.id,
        };
      }

      // Step 2: Self-check for citation accuracy
      console.log(`[Analysis] Running self-check validation...`);
      const validationResult = await this.callLLM<ValidationResult>(
        SELF_CHECK_SYSTEM_PROMPT,
        buildSelfCheckUserPrompt({
          summaryMd: analysisResult.summary_md,
          impactMd: analysisResult.impact_md,
          citations: analysisResult.citations,
        })
      );

      // Step 3: Create Analysis record
      const analysis = await prisma.analysis.create({
        data: {
          sourceItemId: sourceItem.id,
          summaryMd: validationResult.corrected_summary_md,
          impactMd: validationResult.corrected_impact_md,
          citations: JSON.stringify(validationResult.corrected_citations),
          modelMeta: JSON.stringify({
            provider: this.apiProvider,
            model: this.model,
            pediatric_relevant: analysisResult.pediatric_relevant,
            classification: analysisResult.classification,
            pediatric_details: analysisResult.pediatric_details,
            validation_passed: validationResult.validation.passed,
            validation_notes: validationResult.validation.notes,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      console.log(`[Analysis] Created analysis: ${analysis.id}`);

      // Update source item status to REVIEW
      await prisma.sourceItem.update({
        where: { id: sourceItem.id },
        data: { status: "REVIEW" },
      });

      return {
        success: true,
        analysisId: analysis.id,
      };
    } catch (error) {
      console.error(`[Analysis] Error analyzing source item:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Call LLM API (OpenAI or Anthropic)
   */
  private async callLLM<T>(systemPrompt: string, userPrompt: string): Promise<T> {
    if (this.apiProvider === "openai") {
      return this.callOpenAI<T>(systemPrompt, userPrompt);
    } else {
      return this.callAnthropic<T>(systemPrompt, userPrompt);
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI<T>(systemPrompt: string, userPrompt: string): Promise<T> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data: any = await response.json();
    const content = data.choices[0].message.content;
    return JSON.parse(content) as T;
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic<T>(systemPrompt: string, userPrompt: string): Promise<T> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data: any = await response.json();
    const content = data.content[0].text;
    return JSON.parse(content) as T;
  }

  /**
   * Check if analysis service is available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }
}
