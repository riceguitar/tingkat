// ============================================================
// Research Pipeline — shared types
// ============================================================

export type StepName =
  | "serp_research"
  | "internal_links"
  | "external_links"
  | "competition_analysis"
  | "writing_plan"
  | "article_generation";

export interface StepState {
  status: "idle" | "running" | "complete" | "error";
  data?: unknown;
  error?: string;
  /** Accumulates streaming text for writing_plan and article_generation steps */
  streamContent?: string;
}

// ─── Step 1: SERP Research ───────────────────────────────────

export interface SerpOrganicItem {
  rank: number;
  title: string;
  url: string;
  description: string;
}

export interface SerpData {
  organic: SerpOrganicItem[];
  /** People Also Ask questions */
  paa: string[];
  featured_snippet: { text: string; url: string } | null;
  related_searches: string[];
  /** Average word count scraped/estimated from top-5 competitor descriptions */
  avg_competitor_word_count: number;
  keyword_metrics: {
    volume: number;
    difficulty: number;
    cpc: number;
  };
}

// ─── Step 2: Internal Links ──────────────────────────────────

export interface InternalLinkCandidate {
  url: string;
  title: string;
  slug: string;
  relevance_score: number; // 0–100
  suggested_anchor_text: string;
}

// ─── Step 3: External Links ──────────────────────────────────

export interface ExternalLinkCandidate {
  url: string;
  title: string;
  domain: string;
  /** Short description of why/how to cite this source */
  citation_context: string;
}

// ─── Step 4: Competition Analysis ───────────────────────────

export interface CompetitionAnalysis {
  unique_angle: string;
  content_gaps: string[];
  recommended_word_count: number;
  competitor_summary: string;
  /** Suggested H2 + concise-answer structure to target the featured snippet */
  featured_snippet_opportunity: string;
}

// ─── SSE Event payloads ──────────────────────────────────────

export type ResearchSSEEvent =
  | { type: "step_start"; step: StepName; label: string }
  | { type: "step_progress"; step: StepName; message: string }
  | { type: "step_complete"; step: StepName; data: unknown }
  | { type: "step_error"; step: StepName; error: string }
  | { type: "step_chunk"; step: StepName; content: string }
  | { type: "chunk"; content: string; articleId: string }
  | { type: "done"; articleId: string; wordCount: number }
  | { type: "error"; error: string };

// ─── Hook params ─────────────────────────────────────────────

export interface ResearchParams {
  keyword: string;
  primaryKeyword: string;
  clusterKeywords?: string[];
  brief: string;
  tone: string;
  targetWordCount: number;
  projectId: string;
  clusterId?: string;
  pillarPageId?: string | null;
  articleId?: string;
  startFromStep?: StepName;
}

export const STEP_LABELS: Record<StepName, string> = {
  serp_research: "SERP Research",
  internal_links: "Internal Link Gathering",
  external_links: "External Link Gathering",
  competition_analysis: "Competition Analysis",
  writing_plan: "Article Writing Plan",
  article_generation: "Article Generation",
};

export const STEP_ORDER: StepName[] = [
  "serp_research",
  "internal_links",
  "external_links",
  "competition_analysis",
  "writing_plan",
  "article_generation",
];
