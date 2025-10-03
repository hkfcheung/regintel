// Shared TypeScript types for RegIntel

export type SourceType =
  | "guidance"
  | "warning_letter"
  | "untitled_letter"
  | "meeting"
  | "approval"
  | "press";

export type ItemStatus =
  | "intake"
  | "review"
  | "approved"
  | "rejected"
  | "published";

export type UserRole = "viewer" | "reviewer" | "admin";

export type ReviewDecision = "approve" | "reject" | "revise";

export interface Citation {
  url: string;
  locator: string; // e.g., "page 5", "Section 3.2"
  quote?: string;
}

export interface ModelMeta {
  model: string;
  temperature?: number;
  tokens?: number;
  timestamp: string;
}

export interface RaindropTag {
  source?: string; // e.g., "source:fda"
  type?: SourceType;
  week?: string; // e.g., "week:2025-01"
  status?: ItemStatus;
}
