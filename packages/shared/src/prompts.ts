// LLM Prompt Templates for Pediatric Oncology Regulatory Intelligence

export const SUMMARIZE_SYSTEM_PROMPT = `You are a regulatory intelligence assistant for a biopharmaceutical company specializing in pediatric oncology. Your task is to review curated regulatory documents from agencies such as the FDA, EMA, and PMDA.

Only summarize new information relevant to pediatric oncology (drug approvals, label expansions, safety warnings, and regulatory guidance). Ignore adult-only oncology unless pediatric implications are mentioned.

Classify each finding into one of: [Approval, Guidance, Safety Alert, Other].

Extract pediatric-specific details:
- Age groups (neonates, infants, children, adolescents)
- Dosing recommendations
- Safety outcomes and adverse events
- Efficacy data in pediatric populations

Present your output in a structured format with source, date, summary, and implications.

Cite every non-obvious statement with URL + section/page. If unsure or if the document has no pediatric relevance, say so clearly.`;

export function buildSummarizeUserPrompt(params: {
  title: string;
  url: string;
  pdfUrl?: string;
  extractedText: string;
}): string {
  return `Document: ${params.title}
URL: ${params.url}
${params.pdfUrl ? `PDF: ${params.pdfUrl}` : ""}

Extracted text (truncated): ${params.extractedText}

Analyze this document for pediatric oncology relevance and return JSON with:
{
  "pediatric_relevant": boolean,
  "classification": "Approval" | "Guidance" | "Safety Alert" | "Other" | null,
  "summary_md": "Brief summary focusing on pediatric oncology implications (≤200 words)",
  "impact_md": "Impact on Day One for pediatric oncology programs (≤200 words)",
  "pediatric_details": {
    "age_groups": ["neonates", "infants", "children", "adolescents"],
    "dosing": "Pediatric dosing information if available",
    "safety_outcomes": "Key safety findings for pediatric populations",
    "efficacy_data": "Efficacy results in pediatric studies"
  },
  "citations": [{"url": "string", "locator": "page/section", "quote": "optional direct quote"}],
  "needs_more_context": boolean
}

If the document is NOT relevant to pediatric oncology, set pediatric_relevant to false and provide a brief explanation in summary_md.

Prefer PDF citations if available. If insufficient context, set needs_more_context: true.`;
}

export const SELF_CHECK_SYSTEM_PROMPT = `Verify each sentence in summary_md/impact_md maps to at least one citation. Remove or rewrite uncited sentences. Output corrected JSON; include validation: {passed, notes[]}.`;

export function buildSelfCheckUserPrompt(params: {
  summaryMd: string;
  impactMd: string;
  citations: Array<{ url: string; locator: string; quote?: string }>;
}): string {
  return `Summary: ${params.summaryMd}

Impact: ${params.impactMd}

Citations: ${JSON.stringify(params.citations, null, 2)}

Return JSON with:
- corrected_summary_md
- corrected_impact_md
- corrected_citations
- validation: {passed: boolean, notes: string[]}`;
}
