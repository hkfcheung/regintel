/**
 * Analysis Job Processor
 *
 * Processes analysis jobs from the BullMQ queue
 * 1. Fetch source item from database
 * 2. Call AnalysisService to generate pediatric oncology analysis
 * 3. Store analysis results
 * 4. Update source item status
 */

import { Job } from "bullmq";
import { AnalysisService } from "../services/analysisService.js";

const analysisService = new AnalysisService();

interface AnalysisJobData {
  sourceItemId: string;
}

interface AnalysisJobResult {
  analysisId?: string;
  status: "analyzed" | "not_relevant" | "failed";
  error?: string;
}

export async function processAnalysisJob(
  job: Job<AnalysisJobData>
): Promise<AnalysisJobResult> {
  const { sourceItemId } = job.data;

  try {
    console.log(`[AnalysisWorker] Processing analysis for source item: ${sourceItemId}`);

    // Check if analysis service is available
    await job.updateProgress(10);
    if (!analysisService.isAvailable()) {
      throw new Error("Analysis service not available (no API key configured)");
    }

    // Run analysis
    await job.updateProgress(30);
    const result = await analysisService.analyzeSourceItem(sourceItemId);

    await job.updateProgress(100);

    if (!result.success) {
      return {
        status: "failed",
        error: result.error,
      };
    }

    return {
      analysisId: result.analysisId,
      status: "analyzed",
    };
  } catch (error: any) {
    console.error(`[AnalysisWorker] Analysis job failed for ${sourceItemId}:`, error);
    return {
      status: "failed",
      error: error.message || String(error),
    };
  }
}
