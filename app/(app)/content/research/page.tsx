"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useResearchPipeline } from "@/hooks/use-research-pipeline";
import { useProject } from "@/lib/context/project-context";
import type { PillarPage } from "@/types/database";
import type {
  StepName,
  SerpData,
  InternalLinkCandidate,
  ExternalLinkCandidate,
  CompetitionAnalysis,
} from "@/types/research";
import { STEP_LABELS, STEP_ORDER } from "@/types/research";
import {
  Sparkles,
  ArrowRight,
  RotateCcw,
  Tag,
  Layers,
  Search,
  Link2,
  Globe,
  BarChart2,
  FileText,
  PenLine,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";

const TONES = ["professional", "conversational", "authoritative", "friendly", "technical"];

const STEP_ICONS: Record<StepName, JSX.Element> = {
  serp_research: <Search className="h-4 w-4" />,
  internal_links: <Link2 className="h-4 w-4" />,
  external_links: <Globe className="h-4 w-4" />,
  competition_analysis: <BarChart2 className="h-4 w-4" />,
  writing_plan: <FileText className="h-4 w-4" />,
  article_generation: <PenLine className="h-4 w-4" />,
};

export default function ResearchGeneratePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { projects, projectId: contextProjectId } = useProject();
  const { steps, articleId, wordCount, error, isRunning, runAll, runStep, reset, hydrate } =
    useResearchPipeline();

  const [pillars, setPillars] = useState<PillarPage[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Set<StepName>>(new Set());
  const articleRef = useRef<HTMLDivElement>(null);

  const clusterName = searchParams.get("clusterName");
  const clusterKeywords = searchParams.get("keywords");
  const urlProjectId = searchParams.get("projectId");
  const urlClusterId = searchParams.get("clusterId");
  const urlArticleId = searchParams.get("articleId");

  const [form, setForm] = useState({
    keyword: clusterName ?? "",
    primaryKeyword: clusterName ?? "",
    brief: clusterKeywords
      ? `Target keywords from cluster: ${clusterKeywords.split(",").slice(0, 10).join(", ")}`
      : "",
    tone: "professional",
    targetWordCount: 1500,
    projectId: urlProjectId ?? "",
    pillarPageId: "",
    clusterId: urlClusterId ?? "",
  });

  // Load pillars immediately if we have a projectId from the URL
  useEffect(() => {
    if (urlProjectId) loadPillarsAndMaybePrefill(urlProjectId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback: when context loads and we still have no projectId (URL had none), use context
  useEffect(() => {
    if (!contextProjectId) return;
    setForm((prev) => ({
      ...prev,
      projectId: prev.projectId || contextProjectId,
    }));
    // Load pillars if we got the project from context (not URL)
    if (!urlProjectId) loadPillarsAndMaybePrefill(contextProjectId);
  }, [contextProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-expand steps as they complete
  useEffect(() => {
    const newlyComplete = STEP_ORDER.filter((s) => steps[s].status === "complete");
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      newlyComplete.forEach((s) => next.add(s));
      return next;
    });
  }, [steps]);

  // Push articleId into URL so the page can be bookmarked / returned to
  useEffect(() => {
    if (articleId && !searchParams.get("articleId")) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("articleId", articleId);
      router.replace(`/content/research?${params.toString()}`, { scroll: false });
    }
  }, [articleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hydrate from saved research when ?articleId= is present on mount
  useEffect(() => {
    if (!urlArticleId) return;
    fetch(`/api/articles/${urlArticleId}/research`)
      .then((r) => r.json())
      .then(({ article, research }) => {
        if (article) {
          setForm((prev) => ({
            ...prev,
            primaryKeyword: article.primary_keyword ?? prev.primaryKeyword,
            keyword: article.primary_keyword ?? prev.keyword,
            tone: article.tone ?? prev.tone,
            targetWordCount: article.target_word_count ?? prev.targetWordCount,
          }));
        }
        hydrate(urlArticleId, research);
      })
      .catch(() => {
        // Hydration failure is non-fatal — user can still re-run
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll article generation
  useEffect(() => {
    if (articleRef.current && steps.article_generation.streamContent) {
      articleRef.current.scrollTop = articleRef.current.scrollHeight;
    }
  }, [steps.article_generation.streamContent]);

  async function loadPillarsAndMaybePrefill(pid: string) {
    const res = await fetch(`/api/projects/${pid}/pillars`);
    const data = await res.json();
    const pillarList: PillarPage[] = Array.isArray(data) ? data : [];
    setPillars(pillarList);

    if (urlClusterId && pillarList.length > 0) {
      const clusterRes = await fetch(`/api/clusters?projectId=${pid}`);
      const clusters = await clusterRes.json();
      const cluster = Array.isArray(clusters)
        ? clusters.find((c: { id: string; pillar_page_id?: string }) => c.id === urlClusterId)
        : null;
      if (cluster?.pillar_page_id) {
        setForm((prev) => ({ ...prev, pillarPageId: cluster.pillar_page_id }));
      }
    }
  }

  function handleRun(e: React.FormEvent) {
    e.preventDefault();
    if (!form.projectId || !form.primaryKeyword) return;
    reset();
    const kws = clusterKeywords ? clusterKeywords.split(",").map((k) => k.trim()).filter(Boolean) : [];
    runAll({
      keyword: form.keyword || form.primaryKeyword,
      primaryKeyword: form.primaryKeyword,
      clusterKeywords: kws,
      brief: form.brief,
      tone: form.tone,
      targetWordCount: form.targetWordCount,
      projectId: form.projectId,
      clusterId: form.clusterId || undefined,
      pillarPageId: form.pillarPageId || null,
    });
  }

  function handleRerunStep(step: StepName) {
    const kws = clusterKeywords ? clusterKeywords.split(",").map((k) => k.trim()).filter(Boolean) : [];
    runStep(step, {
      keyword: form.keyword || form.primaryKeyword,
      primaryKeyword: form.primaryKeyword,
      clusterKeywords: kws,
      brief: form.brief,
      tone: form.tone,
      targetWordCount: form.targetWordCount,
      projectId: form.projectId,
      clusterId: form.clusterId || undefined,
      pillarPageId: form.pillarPageId || null,
    });
  }

  function toggleExpand(step: StepName) {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      next.has(step) ? next.delete(step) : next.add(step);
      return next;
    });
  }

  const eeatChecklist = (steps.article_generation.data as { eeatChecklist?: Array<{ item: string; status: string }> })
    ?.eeatChecklist;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Research & Generate"
        description="6-step SERP-informed EEAT article creation"
      >
        {articleId && (
          <Button onClick={() => router.push(`/content/${articleId}`)}>
            Open in Editor <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* ── Settings sidebar ── */}
        <Card className="h-fit sticky top-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Generation Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRun} className="space-y-4">
              {clusterName && (
                <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  <Tag className="h-3 w-3 shrink-0" />
                  <span>
                    Cluster:{" "}
                    <span className="font-medium text-foreground">{clusterName}</span>
                  </span>
                </div>
              )}

              {/* Project */}
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Select
                  value={form.projectId}
                  onValueChange={(v) => {
                    setForm({ ...form, projectId: v, pillarPageId: "" });
                    loadPillarsAndMaybePrefill(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Primary keyword — the main SEO target */}
              <div className="space-y-1.5">
                <Label className="font-semibold">
                  Primary keyword{" "}
                  <span className="font-normal text-muted-foreground">(SERP target)</span>
                </Label>
                <Input
                  value={form.primaryKeyword}
                  onChange={(e) => setForm({ ...form, primaryKeyword: e.target.value })}
                  placeholder="e.g. best email marketing tools"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This keyword drives SERP research and competition analysis.
                </p>
              </div>

              {/* Supporting pillar */}
              {pillars.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> Supporting pillar
                  </Label>
                  <Select
                    value={form.pillarPageId || "__none__"}
                    onValueChange={(v) =>
                      setForm({ ...form, pillarPageId: v === "__none__" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {pillars.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Brief */}
              <div className="space-y-1.5">
                <Label>Brief / notes</Label>
                <Textarea
                  value={form.brief}
                  onChange={(e) => setForm({ ...form, brief: e.target.value })}
                  placeholder="Key points to cover, competitor URLs to beat, specific angle..."
                  rows={3}
                />
              </div>

              {/* Tone */}
              <div className="space-y-1.5">
                <Label>Tone</Label>
                <Select
                  value={form.tone}
                  onValueChange={(v) => setForm({ ...form, tone: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Word count */}
              <div className="space-y-1.5">
                <Label>Target word count</Label>
                <Select
                  value={String(form.targetWordCount)}
                  onValueChange={(v) => setForm({ ...form, targetWordCount: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[800, 1000, 1500, 2000, 2500, 3000, 4000].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n.toLocaleString()} words
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isRunning || !form.projectId || !form.primaryKeyword}
                >
                  <Sparkles className="h-4 w-4" />
                  {isRunning ? "Running pipeline…" : "Research & Generate"}
                </Button>
                {!isRunning && STEP_ORDER.some((s) => steps[s].status !== "idle") && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => { reset(); }}
                    title="Reset"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ── Pipeline steps ── */}
        <div className="space-y-3">
          {STEP_ORDER.map((step) => (
            <StepCard
              key={step}
              step={step}
              state={steps[step]}
              expanded={expandedSteps.has(step)}
              onToggle={() => toggleExpand(step)}
              onRerun={() => handleRerunStep(step)}
              isRunning={isRunning}
              articleRef={step === "article_generation" ? articleRef : undefined}
            />
          ))}

          {/* EEAT Checklist */}
          {steps.article_generation.status === "complete" && eeatChecklist && (
            <Card>
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  EEAT Quality Checklist
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ul className="space-y-2">
                  {eeatChecklist.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      {item.status === "pass" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      ) : item.status === "fail" ? (
                        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      )}
                      <span className={item.status === "fail" ? "text-destructive" : ""}>{item.item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {error && (
            <p className="text-sm text-destructive px-1">Pipeline error: {error}</p>
          )}

          {wordCount && (
            <p className="text-xs text-muted-foreground text-right px-1">
              {wordCount.toLocaleString()} words generated
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── StepCard component ───────────────────────────────────────

interface StepCardProps {
  step: StepName;
  state: import("@/types/research").StepState;
  expanded: boolean;
  onToggle: () => void;
  onRerun: () => void;
  isRunning: boolean;
  articleRef?: import("react").RefObject<HTMLDivElement | null>;
}

function StepCard({ step, state, expanded, onToggle, onRerun, isRunning, articleRef }: StepCardProps) {
  const statusColors: Record<string, string> = {
    idle: "secondary",
    running: "default",
    complete: "default",
    error: "destructive",
  };

  const statusLabels: Record<string, string> = {
    idle: "Pending",
    running: "Running…",
    complete: "Complete",
    error: "Error",
  };

  return (
    <Card className={state.status === "running" ? "border-primary/50" : ""}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-3">
          <span className={`text-muted-foreground ${state.status === "running" ? "text-primary" : ""}`}>
            {STEP_ICONS[step]}
          </span>
          <span className="font-medium text-sm flex-1">{STEP_LABELS[step]}</span>

          {/* Status badge */}
          <Badge
            variant={statusColors[state.status] as "secondary" | "default" | "destructive"}
            className={`text-xs ${state.status === "complete" ? "bg-green-500/10 text-green-700 border-green-200 dark:text-green-400" : ""}`}
          >
            {state.status === "running" && (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            )}
            {statusLabels[state.status]}
          </Badge>

          {/* Re-run button */}
          {(state.status === "complete" || state.status === "error") && !isRunning && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => { e.stopPropagation(); onRerun(); }}
              title={`Re-run ${STEP_LABELS[step]}`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Expand/collapse */}
          {(state.status === "complete" || state.streamContent || state.status === "error") && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onToggle}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}
        </div>

        {/* Running progress message */}
        {state.status === "running" && state.data && (
          <p className="text-xs text-muted-foreground mt-1 pl-7">
            {(state.data as { message?: string }).message ?? "Working…"}
          </p>
        )}
      </CardHeader>

      {/* Expanded content */}
      {expanded && (
        <CardContent className="pt-0 px-4 pb-4 border-t">
          <StepResult step={step} state={state} articleRef={articleRef} />
        </CardContent>
      )}
    </Card>
  );
}

// ─── StepResult — renders step-specific output ────────────────

function StepResult({
  step,
  state,
  articleRef,
}: {
  step: StepName;
  state: import("@/types/research").StepState;
  articleRef?: import("react").RefObject<HTMLDivElement | null>;
}) {
  if (state.status === "error") {
    return <p className="text-sm text-destructive mt-3">{state.error}</p>;
  }

  switch (step) {
    case "serp_research": {
      const data = state.data as SerpData | undefined;
      if (!data) return null;
      return (
        <div className="mt-3 space-y-4 text-sm">
          {/* Keyword metrics */}
          <div className="flex gap-4 flex-wrap">
            <Metric
              label="Search Volume"
              value={data.keyword_metrics.volume ? data.keyword_metrics.volume.toLocaleString() : "N/A"}
            />
            <Metric
              label="Difficulty"
              value={data.keyword_metrics.difficulty ? `${data.keyword_metrics.difficulty}/100` : "N/A"}
            />
            <Metric
              label="CPC"
              value={data.keyword_metrics.cpc ? `$${data.keyword_metrics.cpc.toFixed(2)}` : "N/A"}
            />
            <Metric label="Avg Competitor Words" value={data.avg_competitor_word_count.toLocaleString()} />
          </div>

          {/* Top organic results */}
          {data.organic.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                Top {data.organic.length} Results
              </p>
              <div className="space-y-1.5">
                {data.organic.slice(0, 5).map((r) => (
                  <div key={r.rank} className="flex gap-2">
                    <span className="text-muted-foreground w-5 shrink-0">#{r.rank}</span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.url}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PAA questions */}
          {data.paa.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                People Also Ask ({data.paa.length})
              </p>
              <ul className="space-y-1">
                {data.paa.map((q, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="shrink-0">→</span> {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Featured snippet */}
          {data.featured_snippet && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Featured Snippet Exists</p>
              <p className="text-xs text-amber-600 dark:text-amber-500 line-clamp-2">{data.featured_snippet.text}</p>
            </div>
          )}
        </div>
      );
    }

    case "internal_links": {
      const data = state.data as InternalLinkCandidate[] | undefined;
      if (!data || data.length === 0) return <p className="text-sm text-muted-foreground mt-3">No internal links found.</p>;
      return (
        <div className="mt-3 space-y-2">
          {data.map((link, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-muted-foreground shrink-0 mt-0.5 text-xs">{link.relevance_score}</span>
              <div className="min-w-0">
                <p className="font-medium truncate">{link.title}</p>
                <p className="text-xs text-muted-foreground">
                  Anchor: &ldquo;{link.suggested_anchor_text}&rdquo;
                </p>
              </div>
            </div>
          ))}
        </div>
      );
    }

    case "external_links": {
      const data = state.data as ExternalLinkCandidate[] | undefined;
      if (!data || data.length === 0) return <p className="text-sm text-muted-foreground mt-3">No external sources found.</p>;
      return (
        <div className="mt-3 space-y-2">
          {data.map((link, i) => (
            <div key={i} className="text-sm">
              <p className="font-medium truncate">{link.title}</p>
              <p className="text-xs text-muted-foreground">{link.domain}</p>
              {link.citation_context && (
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{link.citation_context}</p>
              )}
            </div>
          ))}
        </div>
      );
    }

    case "competition_analysis": {
      const data = state.data as CompetitionAnalysis | undefined;
      if (!data) return null;
      return (
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Unique Angle</p>
            <p>{data.unique_angle}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Content Gaps</p>
            <ul className="space-y-0.5">
              {data.content_gaps.map((g, i) => (
                <li key={i} className="flex gap-1.5 text-muted-foreground">
                  <span className="shrink-0">•</span> {g}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-4">
            <Metric label="Recommended Words" value={data.recommended_word_count.toLocaleString()} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Featured Snippet Opportunity</p>
            <p className="text-muted-foreground text-xs">{data.featured_snippet_opportunity}</p>
          </div>
        </div>
      );
    }

    case "writing_plan": {
      const content = state.streamContent ?? "";
      if (!content) return null;
      return (
        <div className="mt-3 text-sm leading-relaxed whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
          {content}
          {state.status === "running" && (
            <span className="inline-block h-4 w-0.5 bg-foreground animate-pulse ml-0.5" />
          )}
        </div>
      );
    }

    case "article_generation": {
      const content = state.streamContent ?? "";
      if (!content) return null;
      return (
        <div
          ref={articleRef}
          className="mt-3 text-sm leading-relaxed whitespace-pre-wrap font-mono max-h-[60vh] overflow-y-auto"
        >
          {content}
          {state.status === "running" && (
            <span className="inline-block h-4 w-0.5 bg-foreground animate-pulse ml-0.5" />
          )}
        </div>
      );
    }

    default:
      return null;
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
