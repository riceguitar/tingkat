import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSerpData, getContentAnalysis } from "@/lib/api/dataforseo";
import {
  scoreInternalLinks,
  analyzeCompetitors,
  streamWritingPlan,
  streamResearchArticle,
  buildResearchArticlePrompt,
  type InternalLinkSource,
} from "@/lib/api/gemini";
import type {
  StepName,
  SerpData,
  InternalLinkCandidate,
  ExternalLinkCandidate,
  CompetitionAnalysis,
  ResearchSSEEvent,
} from "@/types/research";
import { STEP_ORDER } from "@/types/research";

// ─── SSE helpers ─────────────────────────────────────────────

function encode(encoder: TextEncoder, event: ResearchSSEEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

// ─── Route handler ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    keyword,
    primaryKeyword,
    clusterKeywords = [],
    brief = "",
    tone = "professional",
    targetWordCount = 1500,
    projectId,
    clusterId,
    pillarPageId,
    articleId: existingArticleId,
    startFromStep,
    contentFormat,
    audienceLevel,
    pointOfView,
  } = body as {
    keyword: string;
    primaryKeyword: string;
    clusterKeywords?: string[];
    brief?: string;
    tone?: string;
    targetWordCount?: number;
    projectId: string;
    clusterId?: string;
    pillarPageId?: string;
    articleId?: string;
    startFromStep?: StepName;
    contentFormat?: string;
    audienceLevel?: string;
    pointOfView?: string;
  };

  if (!primaryKeyword || !projectId) {
    return NextResponse.json({ error: "primaryKeyword and projectId are required" }, { status: 400 });
  }

  const supabase = await createClient();

  // Resolve pillar page
  let pillar: { url: string; title: string } | null = null;
  if (pillarPageId) {
    const { data } = await supabase
      .from("pillar_pages")
      .select("url, title")
      .eq("id", pillarPageId)
      .single();
    if (data) pillar = data;
  }

  // Create or reuse article record
  let articleId = existingArticleId ?? null;
  if (!articleId) {
    const { data } = await supabase
      .from("articles")
      .insert({
        project_id: projectId,
        cluster_id: clusterId ?? null,
        pillar_page_id: pillarPageId ?? null,
        primary_keyword: primaryKeyword,
        status: "draft",
        tone,
        target_word_count: targetWordCount,
        generation_model: "claude-sonnet-4-5",
        generation_prompt: `research-pipeline:${primaryKeyword}`,
      })
      .select()
      .single();
    articleId = data?.id ?? null;
  }

  // Load existing research row if re-running a step
  let existingResearch: Record<string, unknown> = {};
  if (articleId) {
    const { data } = await supabase
      .from("article_research")
      .select("*")
      .eq("article_id", articleId)
      .single();
    if (data) existingResearch = data as Record<string, unknown>;
  }

  const encoder = new TextEncoder();

  // Determine which steps to run
  const startIdx = startFromStep ? STEP_ORDER.indexOf(startFromStep) : 0;
  const stepsToRun = STEP_ORDER.slice(startIdx);

  const stream = new ReadableStream({
    async start(controller) {
      // Carry forward data from prior (skipped) steps
      let serpData: SerpData = (existingResearch.serp_data as SerpData) ?? null;
      let internalLinks: InternalLinkCandidate[] = (existingResearch.internal_links as InternalLinkCandidate[]) ?? [];
      let externalLinks: ExternalLinkCandidate[] = (existingResearch.external_links as ExternalLinkCandidate[]) ?? [];
      let competitionAnalysis: CompetitionAnalysis = (existingResearch.competition_analysis as CompetitionAnalysis) ?? null;
      let writingPlan = (existingResearch.writing_plan as string) ?? "";

      try {
        for (const step of stepsToRun) {
          // ── Step 1: SERP Research ────────────────────────
          if (step === "serp_research") {
            controller.enqueue(encode(encoder, { type: "step_start", step, label: "Researching SERP landscape…" }));
            try {
              controller.enqueue(encode(encoder, { type: "step_progress", step, message: `Fetching Google SERP for "${primaryKeyword}"…` }));
              serpData = await getSerpData(primaryKeyword);

              // Cannibalization check — GSC + sitemap pages
              const [{ data: gscToken }, { data: sitemapMatch }] = await Promise.all([
                supabase.from("gsc_tokens").select("gsc_property_url").eq("project_id", projectId).single(),
                supabase
                  .from("sitemap_pages")
                  .select("url, title, h1")
                  .eq("project_id", projectId)
                  .or(`title.ilike.%${primaryKeyword}%,h1.ilike.%${primaryKeyword}%`)
                  .limit(1)
                  .single(),
              ]);

              if (sitemapMatch) {
                controller.enqueue(encode(encoder, {
                  type: "step_progress",
                  step,
                  message: `⚠️ Cannibalization warning: your sitemap already has a page targeting this keyword — "${sitemapMatch.h1 ?? sitemapMatch.title}" at ${sitemapMatch.url}`,
                }));
              }

              if (gscToken?.gsc_property_url) {
                const { data: existingRank } = await supabase
                  .from("gsc_snapshots")
                  .select("position, page")
                  .eq("project_id", projectId)
                  .ilike("query", `%${primaryKeyword}%`)
                  .order("snapshot_date", { ascending: false })
                  .limit(1)
                  .single();

                if (existingRank && existingRank.position && existingRank.position <= 20) {
                  controller.enqueue(encode(encoder, {
                    type: "step_progress",
                    step,
                    message: `⚠️ Cannibalization warning: your site already ranks #${Math.round(existingRank.position)} for this keyword at ${existingRank.page}`,
                  }));
                }
              }

              // Word count advisory
              if (serpData.avg_competitor_word_count > targetWordCount * 1.2) {
                controller.enqueue(encode(encoder, {
                  type: "step_progress",
                  step,
                  message: `⚠️ Competitors average ${serpData.avg_competitor_word_count} words — consider increasing your target above ${targetWordCount}`,
                }));
              }

              await upsertResearch(supabase, articleId, primaryKeyword, { serp_data: serpData });
              controller.enqueue(encode(encoder, { type: "step_complete", step, data: serpData }));
            } catch (err) {
              const msg = err instanceof Error ? err.message : "SERP research failed";
              controller.enqueue(encode(encoder, { type: "step_error", step, error: msg }));
              // Non-fatal: continue with empty serpData
              serpData = {
                organic: [], paa: [], featured_snippet: null,
                related_searches: [], avg_competitor_word_count: targetWordCount,
                keyword_metrics: { volume: 0, difficulty: 0, cpc: 0 },
              };
            }
          }

          // ── Step 2: Internal Links ───────────────────────
          if (step === "internal_links") {
            controller.enqueue(encode(encoder, { type: "step_start", step, label: "Gathering internal link opportunities…" }));
            try {
              const [articlesRes, pillarsRes, sitemapPagesRes] = await Promise.all([
                supabase
                  .from("articles")
                  .select("title, slug")
                  .eq("project_id", projectId)
                  .eq("status", "published")
                  .not("id", "eq", articleId ?? "")
                  .limit(50),
                supabase
                  .from("pillar_pages")
                  .select("title, url")
                  .eq("project_id", projectId),
                supabase
                  .from("sitemap_pages")
                  .select("url, title, h1")
                  .eq("project_id", projectId)
                  .not("title", "is", null)
                  .limit(100),
              ]);

              const seenUrls = new Set<string>();
              const candidates: InternalLinkSource[] = [
                ...(articlesRes.data ?? []).map((a) => ({
                  url: `/${a.slug}`,
                  title: a.title ?? "",
                  slug: a.slug ?? "",
                })),
                ...(pillarsRes.data ?? []).map((p) => ({
                  url: p.url,
                  title: p.title ?? "",
                  slug: p.url,
                })),
                ...(sitemapPagesRes.data ?? []).map((p) => ({
                  url: p.url,
                  title: p.h1 ?? p.title ?? "",
                  slug: p.url,
                })),
              ].filter((c) => {
                if (!c.title || !c.url) return false;
                if (seenUrls.has(c.url)) return false;
                seenUrls.add(c.url);
                return true;
              });

              controller.enqueue(encode(encoder, {
                type: "step_progress", step,
                message: `Scoring ${candidates.length} internal pages for relevance…`,
              }));

              internalLinks = await scoreInternalLinks(primaryKeyword, candidates);
              await upsertResearch(supabase, articleId, primaryKeyword, { internal_links: internalLinks });
              controller.enqueue(encode(encoder, { type: "step_complete", step, data: internalLinks }));
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Internal link gathering failed";
              controller.enqueue(encode(encoder, { type: "step_error", step, error: msg }));
              internalLinks = [];
            }
          }

          // ── Step 3: External Links ───────────────────────
          if (step === "external_links") {
            controller.enqueue(encode(encoder, { type: "step_start", step, label: "Finding authoritative external sources…" }));
            try {
              controller.enqueue(encode(encoder, {
                type: "step_progress", step,
                message: `Searching DataForSEO content analysis for "${primaryKeyword}"…`,
              }));

              externalLinks = await getContentAnalysis(primaryKeyword);
              await upsertResearch(supabase, articleId, primaryKeyword, { external_links: externalLinks });
              controller.enqueue(encode(encoder, { type: "step_complete", step, data: externalLinks }));
            } catch (err) {
              const msg = err instanceof Error ? err.message : "External link gathering failed";
              controller.enqueue(encode(encoder, { type: "step_error", step, error: msg }));
              externalLinks = [];
            }
          }

          // ── Step 4: Competition Analysis ─────────────────
          if (step === "competition_analysis") {
            controller.enqueue(encode(encoder, { type: "step_start", step, label: "Analysing competition for unique angle…" }));
            try {
              controller.enqueue(encode(encoder, {
                type: "step_progress", step,
                message: "Claude is analysing top 10 competitors…",
              }));

              competitionAnalysis = await analyzeCompetitors(serpData, primaryKeyword, clusterKeywords);
              await upsertResearch(supabase, articleId, primaryKeyword, { competition_analysis: competitionAnalysis });
              controller.enqueue(encode(encoder, { type: "step_complete", step, data: competitionAnalysis }));
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Competition analysis failed";
              controller.enqueue(encode(encoder, { type: "step_error", step, error: msg }));
              competitionAnalysis = {
                unique_angle: "Comprehensive, practitioner-level guide with examples.",
                content_gaps: ["Practical examples", "Common mistakes"],
                recommended_word_count: targetWordCount,
                competitor_summary: "Competitors cover the topic broadly.",
                featured_snippet_opportunity: "Open with a clear definition and 50-word answer.",
              };
            }
          }

          // ── Step 5: Writing Plan ─────────────────────────
          if (step === "writing_plan") {
            controller.enqueue(encode(encoder, { type: "step_start", step, label: "Creating article writing plan…" }));
            try {
              writingPlan = "";
              for await (const chunk of streamWritingPlan({
                primaryKeyword,
                clusterKeywords,
                serpData,
                internalLinks,
                externalLinks,
                competitionAnalysis,
                tone,
                brief,
                targetWordCount,
              })) {
                writingPlan += chunk;
                controller.enqueue(encode(encoder, { type: "step_chunk", step, content: chunk }));
              }
              await upsertResearch(supabase, articleId, primaryKeyword, { writing_plan: writingPlan });
              controller.enqueue(encode(encoder, { type: "step_complete", step, data: { length: writingPlan.length } }));
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Writing plan failed";
              controller.enqueue(encode(encoder, { type: "step_error", step, error: msg }));
              writingPlan = "";
            }
          }

          // ── Step 6: Article Generation ───────────────────
          if (step === "article_generation") {
            controller.enqueue(encode(encoder, { type: "step_start", step, label: "Writing the article…" }));
            try {
              const effectiveWordCount = targetWordCount;

              let fullText = "";
              for await (const chunk of streamResearchArticle({
                primaryKeyword,
                clusterKeywords,
                serpData,
                internalLinks,
                externalLinks,
                competitionAnalysis,
                writingPlan,
                tone,
                targetWordCount: effectiveWordCount,
                brief,
                pillar,
                contentFormat,
                audienceLevel,
                pointOfView,
              })) {
                fullText += chunk;
                controller.enqueue(encode(encoder, { type: "chunk", content: chunk, articleId: articleId ?? "" }));
              }

              // Parse structured output
              const metaMatch = fullText.match(/<meta>([\s\S]*?)<\/meta>/);
              const articleMatch = fullText.match(/<article>([\s\S]*?)<\/article>/);
              const outlineMatch = fullText.match(/<outline>([\s\S]*?)<\/outline>/);
              const schemaMatch = fullText.match(/<schema>([\s\S]*?)<\/schema>/);

              let parsedMeta: { title?: string; slug?: string; meta_description?: string } = {};
              let parsedOutline: Array<{ level: number; text: string }> = [];
              const articleContent = articleMatch?.[1]?.trim() ?? fullText;
              const schemaMarkup = schemaMatch?.[1]?.trim() ?? null;

              try { if (metaMatch) parsedMeta = JSON.parse(metaMatch[1].trim()); } catch { /* ignore */ }
              try { if (outlineMatch) parsedOutline = JSON.parse(outlineMatch[1].trim()); } catch { /* ignore */ }

              const wordCount = articleContent.split(/\s+/).filter(Boolean).length;

              // EEAT checklist evaluation
              const eeatChecklist = buildEeatChecklist(articleContent, internalLinks, externalLinks, serpData.paa);

              // Persist article + research
              if (articleId) {
                await Promise.all([
                  supabase.from("articles").update({
                    title: parsedMeta.title ?? keyword ?? primaryKeyword,
                    slug: parsedMeta.slug ?? primaryKeyword.toLowerCase().replace(/\s+/g, "-"),
                    meta_description: parsedMeta.meta_description ?? null,
                    content: articleContent,
                    outline: parsedOutline.length ? parsedOutline : null,
                    actual_word_count: wordCount,
                    generation_prompt: buildResearchArticlePrompt({
                      primaryKeyword, clusterKeywords, serpData,
                      internalLinks, externalLinks, competitionAnalysis,
                      writingPlan, tone, targetWordCount: effectiveWordCount, brief, pillar,
                      contentFormat, audienceLevel, pointOfView,
                    }),
                  }).eq("id", articleId),
                  upsertResearch(supabase, articleId, primaryKeyword, {
                    schema_markup: schemaMarkup,
                    eeat_checklist: eeatChecklist,
                  }),
                ]);
              }

              controller.enqueue(encode(encoder, { type: "done", articleId: articleId ?? "", wordCount }));
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Article generation failed";
              controller.enqueue(encode(encoder, { type: "step_error", step, error: msg }));
              controller.enqueue(encode(encoder, { type: "error", error: msg }));
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Pipeline failed";
        controller.enqueue(encode(encoder, { type: "error", error: msg }));
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────

async function upsertResearch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  articleId: string | null,
  primaryKeyword: string,
  patch: Record<string, unknown>
) {
  if (!articleId) return;
  await supabase.from("article_research").upsert(
    { article_id: articleId, primary_keyword: primaryKeyword, ...patch },
    { onConflict: "article_id" }
  );
}

function buildEeatChecklist(
  content: string,
  internalLinks: InternalLinkCandidate[],
  externalLinks: ExternalLinkCandidate[],
  paaQuestions: string[]
): Array<{ item: string; status: "pass" | "warn" | "fail" }> {
  const checks: Array<{ item: string; status: "pass" | "warn" | "fail" }> = [];

  // Internal links woven in
  const hasInternalLinks = internalLinks.some((l) => content.includes(l.url) || content.includes(l.suggested_anchor_text));
  checks.push({ item: "Internal links included", status: hasInternalLinks ? "pass" : internalLinks.length === 0 ? "warn" : "fail" });

  // External citations
  const hasExternalLinks = externalLinks.some((l) => content.includes(l.url) || content.includes(l.domain));
  checks.push({ item: "External citations included", status: hasExternalLinks ? "pass" : externalLinks.length === 0 ? "warn" : "fail" });

  // FAQ section
  const hasFaq = /#{1,3}\s*(FAQ|Frequently Asked|Common Questions)/i.test(content);
  checks.push({ item: "FAQ section present", status: hasFaq ? "pass" : paaQuestions.length > 0 ? "fail" : "warn" });

  // Statistics / data placeholders
  const hasStats = /\[STAT:/i.test(content) || /\d+%/.test(content) || /\d{4,}/.test(content);
  checks.push({ item: "Statistics or data references included", status: hasStats ? "pass" : "warn" });

  // Freshness signal
  const currentYear = new Date().getFullYear();
  const hasFreshness = content.includes(String(currentYear));
  checks.push({ item: `Freshness signal (${currentYear}) present`, status: hasFreshness ? "pass" : "warn" });

  // Word count proxy
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  checks.push({ item: `Word count: ${wordCount.toLocaleString()} words`, status: wordCount >= 1200 ? "pass" : "warn" });

  return checks;
}
