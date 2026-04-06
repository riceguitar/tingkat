import Anthropic from "@anthropic-ai/sdk";
import type {
  SerpData,
  InternalLinkCandidate,
  ExternalLinkCandidate,
  CompetitionAnalysis,
} from "@/types/research";

export const MODEL = "claude-sonnet-4-5";

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}

// ============================================================
// Article generation prompt
// ============================================================
export interface GenerationParams {
  keyword: string;
  brief: string;
  tone: string;
  targetWordCount: number;
  pillar?: { url: string; title: string } | null;
}

export function buildArticlePrompt(params: GenerationParams): string {
  const pillarContext = params.pillar
    ? `\nSupporting pillar page: "${params.pillar.title}" (${params.pillar.url})
This blog post should naturally support and internally link to the above pillar page.`
    : "";

  return `You are an expert SEO content writer. Generate a complete, high-quality SEO-optimized blog article.

Target keyword: "${params.keyword}"
Tone: ${params.tone}
Target word count: ${params.targetWordCount} words
Brief/notes: ${params.brief || "None provided"}${pillarContext}

Output your response in this exact format:

<meta>
{
  "title": "Article title here (include keyword naturally)",
  "slug": "url-friendly-slug",
  "meta_description": "Compelling 150-160 char meta description with keyword"
}
</meta>

<outline>
[
  {"level": 1, "text": "H1 Title"},
  {"level": 2, "text": "Section 1"},
  {"level": 3, "text": "Subsection"},
  {"level": 2, "text": "Section 2"}
]
</outline>

<article>
Full markdown article content here. Use proper heading hierarchy (# for H1, ## for H2, ### for H3).
Include the target keyword naturally throughout. Write at least ${params.targetWordCount} words.
Include a compelling introduction, well-structured body sections, and a conclusion.
</article>`;
}

// ============================================================
// Streaming article generation — returns an async generator
// of text chunks
// ============================================================
export async function* streamArticle(
  prompt: string
): AsyncGenerator<string> {
  const client = getClient();

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  for await (const chunk of stream) {
    if (
      chunk.type === "content_block_delta" &&
      chunk.delta.type === "text_delta"
    ) {
      yield chunk.delta.text;
    }
  }
}

// ============================================================
// Research pipeline — internal link scoring
// ============================================================
export interface InternalLinkSource {
  url: string;
  title: string;
  slug: string;
}

export async function scoreInternalLinks(
  articleTopic: string,
  candidates: InternalLinkSource[]
): Promise<InternalLinkCandidate[]> {
  if (candidates.length === 0) return [];
  const client = getClient();

  const list = candidates
    .map((c, i) => `${i + 1}. "${c.title}" — ${c.url}`)
    .join("\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are an SEO internal linking expert. Score each page below for relevance to a new article about: "${articleTopic}".

Pages:
${list}

Return ONLY valid JSON array. For each page provide:
- index (1-based, matching the list above)
- relevance_score (0-100, where 100 = highly relevant, 0 = irrelevant)
- suggested_anchor_text (natural anchor text, 2-6 words, keyword-rich)

Only include pages with relevance_score >= 30. Sort by relevance_score descending. Return at most 8.

Format:
[{"index": 1, "relevance_score": 85, "suggested_anchor_text": "email marketing best practices"}]`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "[]";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const scored: Array<{ index: number; relevance_score: number; suggested_anchor_text: string }> =
      JSON.parse(jsonMatch[0]);
    return scored
      .map((s) => {
        const candidate = candidates[s.index - 1];
        if (!candidate) return null;
        return {
          url: candidate.url,
          title: candidate.title,
          slug: candidate.slug,
          relevance_score: s.relevance_score,
          suggested_anchor_text: s.suggested_anchor_text,
        };
      })
      .filter((x): x is InternalLinkCandidate => x !== null);
  } catch {
    return [];
  }
}

// ============================================================
// Research pipeline — competition analysis
// ============================================================
export async function analyzeCompetitors(
  serpData: SerpData,
  keyword: string,
  clusterKeywords: string[]
): Promise<CompetitionAnalysis> {
  const client = getClient();

  const competitorList = serpData.organic
    .slice(0, 10)
    .map((o, i) => `${i + 1}. [${o.rank}] "${o.title}" — ${o.url}\n   ${o.description}`)
    .join("\n\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are an expert SEO strategist. Analyze the current top Google results for "${keyword}" and identify the best strategy to outrank them.

Top SERP competitors:
${competitorList}

Cluster keywords to cover: ${clusterKeywords.join(", ") || "none"}

Return ONLY valid JSON with this structure:
{
  "unique_angle": "A distinct angle or POV that differentiates from all current top results (1-2 sentences)",
  "content_gaps": ["Gap 1 competitors miss", "Gap 2", "Gap 3"],
  "recommended_word_count": 2200,
  "competitor_summary": "2-3 sentence summary of what the top results all do and where they fall short",
  "featured_snippet_opportunity": "Describe one specific H2 + concise-answer (40-60 words) structure that could win the featured snippet"
}`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      unique_angle: "Provide a comprehensive, practitioner-level guide with real examples.",
      content_gaps: ["Practical examples", "Common mistakes", "Step-by-step guidance"],
      recommended_word_count: 2000,
      competitor_summary: "Competitors cover the topic broadly without deep practical detail.",
      featured_snippet_opportunity: "Start with a clear H2 definition and a concise 50-word answer.",
    };
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {
      unique_angle: "Provide a comprehensive, practitioner-level guide with real examples.",
      content_gaps: ["Practical examples", "Common mistakes", "Step-by-step guidance"],
      recommended_word_count: 2000,
      competitor_summary: "Competitors cover the topic broadly without deep practical detail.",
      featured_snippet_opportunity: "Start with a clear H2 definition and a concise 50-word answer.",
    };
  }
}

// ============================================================
// Research pipeline — streaming writing plan
// ============================================================
export interface WritingPlanParams {
  primaryKeyword: string;
  clusterKeywords: string[];
  serpData: SerpData;
  internalLinks: InternalLinkCandidate[];
  externalLinks: ExternalLinkCandidate[];
  competitionAnalysis: CompetitionAnalysis;
  tone: string;
  brief: string;
  targetWordCount: number;
}

export async function* streamWritingPlan(
  params: WritingPlanParams
): AsyncGenerator<string> {
  const client = getClient();

  const internalLinkList = params.internalLinks
    .slice(0, 6)
    .map((l) => `- "${l.suggested_anchor_text}" → ${l.url} (${l.title})`)
    .join("\n") || "None available";

  const externalLinkList = params.externalLinks
    .slice(0, 6)
    .map((l) => `- ${l.domain}: ${l.title} (${l.citation_context})`)
    .join("\n") || "None available";

  const paaList = params.serpData.paa.slice(0, 8).map((q) => `- ${q}`).join("\n") || "None found";

  const prompt = `You are an expert SEO content strategist. Create a detailed article writing plan for the article described below. This plan will be handed directly to a writer.

PRIMARY KEYWORD: "${params.primaryKeyword}"
SEMANTIC KEYWORDS TO COVER: ${params.clusterKeywords.join(", ") || "none"}
TONE: ${params.tone}
TARGET WORD COUNT: ${params.targetWordCount} words (competitor average: ${params.serpData.avg_competitor_word_count})
BRIEF: ${params.brief || "None provided"}

UNIQUE ANGLE TO TAKE:
${params.competitionAnalysis.unique_angle}

CONTENT GAPS TO FILL:
${params.competitionAnalysis.content_gaps.map((g) => `- ${g}`).join("\n")}

FEATURED SNIPPET OPPORTUNITY:
${params.competitionAnalysis.featured_snippet_opportunity}

PEOPLE ALSO ASK (use as FAQs):
${paaList}

INTERNAL LINKS TO WEAVE IN:
${internalLinkList}

EXTERNAL SOURCES TO CITE:
${externalLinkList}

---

Produce the writing plan in this format:

## H1: [Exact article title with primary keyword]

**Meta description** (150-160 chars): [write it here]

**Schema type**: [Article | FAQPage | HowTo | Article+FAQPage]

---

### Outline

For each section, specify:
- The H2/H3 heading
- 2-3 bullet points of what to cover
- Where to place internal links (with anchor text)
- Where to cite external sources
- Word count target for this section

---

### FAQ Section
List the 4-6 FAQ questions (from PAA) with a brief note on what each answer should cover.

---

### EEAT Notes
3-5 specific instructions for the writer to embed expertise, authoritativeness, and trust signals (e.g., include a statistic from [source], write from practitioner POV, add a [STAT: ...] placeholder).`;

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  for await (const chunk of stream) {
    if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
      yield chunk.delta.text;
    }
  }
}

// ============================================================
// Research pipeline — full article with research context
// ============================================================
export interface ResearchArticleParams {
  primaryKeyword: string;
  clusterKeywords: string[];
  serpData: SerpData;
  internalLinks: InternalLinkCandidate[];
  externalLinks: ExternalLinkCandidate[];
  competitionAnalysis: CompetitionAnalysis;
  writingPlan: string;
  tone: string;
  targetWordCount: number;
  brief: string;
  pillar?: { url: string; title: string } | null;
}

export function buildResearchArticlePrompt(params: ResearchArticleParams): string {
  const pillarContext = params.pillar
    ? `\nSupporting pillar page: "${params.pillar.title}" (${params.pillar.url}) — link to this naturally in the introduction or a relevant section.`
    : "";

  const internalLinkList = params.internalLinks
    .slice(0, 6)
    .map((l) => `- Use anchor text "${l.suggested_anchor_text}" to link to ${l.url}`)
    .join("\n") || "None";

  const externalLinkList = params.externalLinks
    .slice(0, 6)
    .map((l) => `- Cite ${l.domain} (${l.url}): ${l.citation_context}`)
    .join("\n") || "None";

  const paaFaqs = params.serpData.paa.slice(0, 6).join("\n- ") || "None";

  const semanticKeywords = params.clusterKeywords.length
    ? `Semantic keywords to use naturally throughout: ${params.clusterKeywords.join(", ")}.`
    : "";

  return `You are an expert SEO content writer with deep practitioner experience. Write a complete, EEAT-optimised article following the plan and research below.

PRIMARY KEYWORD: "${params.primaryKeyword}"
TONE: ${params.tone}
TARGET WORD COUNT: ${params.targetWordCount} words minimum (competitor average is ${params.serpData.avg_competitor_word_count} — aim to beat them)
BRIEF: ${params.brief || "None"}${pillarContext}

${semanticKeywords}

UNIQUE ANGLE: ${params.competitionAnalysis.unique_angle}

WRITING PLAN TO FOLLOW:
${params.writingPlan}

INTERNAL LINKS — include ALL of these naturally in the article:
${internalLinkList}

EXTERNAL CITATIONS — cite these inline where relevant:
${externalLinkList}

FAQ QUESTIONS — include a FAQ section near the end answering each:
- ${paaFaqs}

EEAT REQUIREMENTS:
- Write from a first-hand expert perspective (use "in our experience", "practitioners find", "the data shows")
- Where you reference a statistic you don't have exact figures for, insert [STAT: brief description of the statistic needed] as a placeholder
- Include at least one real-world example or case study (can be anonymised)
- Ensure the article has a clear publication/freshness signal (e.g., "As of ${new Date().getFullYear()},...")
- Structure one section specifically to target the featured snippet: ${params.competitionAnalysis.featured_snippet_opportunity}

Output your response in this exact format:

<meta>
{
  "title": "Article title (include primary keyword naturally)",
  "slug": "url-friendly-slug",
  "meta_description": "Compelling 150-160 char meta description with keyword"
}
</meta>

<schema>
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "[article title]",
      "description": "[meta description]",
      "datePublished": "${new Date().toISOString().split("T")[0]}",
      "dateModified": "${new Date().toISOString().split("T")[0]}"
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "[FAQ Q1]", "acceptedAnswer": { "@type": "Answer", "text": "[concise answer]" } }
      ]
    }
  ]
}
</schema>

<outline>
[{"level": 1, "text": "H1 Title"}, {"level": 2, "text": "Section"}, {"level": 3, "text": "Subsection"}]
</outline>

<article>
Full markdown article. Use proper heading hierarchy (# H1, ## H2, ### H3).
Write at least ${params.targetWordCount} words.
Include all internal links as markdown [anchor text](url).
Include all external citations as markdown [source name](url).
Include a ## Frequently Asked Questions section with H3 for each question.
</article>`;
}

export async function* streamResearchArticle(
  params: ResearchArticleParams
): AsyncGenerator<string> {
  const prompt = buildResearchArticlePrompt(params);
  const client = getClient();

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    messages: [{ role: "user", content: prompt }],
  });

  for await (const chunk of stream) {
    if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
      yield chunk.delta.text;
    }
  }
}

// ============================================================
// Keyword clustering
// ============================================================
export interface ClusterResult {
  name: string;
  intent: string;
  color: string;
  keywords: string[];
}

export async function clusterKeywords(
  keywords: Array<{ keyword: string; volume?: number; intent?: string }>,
  maxClusters = 8
): Promise<ClusterResult[]> {
  const client = getClient();

  const keywordList = keywords
    .map(
      (k) =>
        `- ${k.keyword}${k.volume ? ` (vol: ${k.volume})` : ""}${k.intent ? ` [${k.intent}]` : ""}`
    )
    .join("\n");

  const prompt = `Group these keywords into ${maxClusters} or fewer topical clusters. Each cluster should represent a distinct topic or subtopic that could be a content pillar.

Keywords:
${keywordList}

Return ONLY valid JSON in this exact format:
[
  {
    "name": "Cluster name",
    "intent": "informational|commercial|transactional|navigational",
    "color": "#hexcolor",
    "keywords": ["keyword1", "keyword2"]
  }
]

Use distinct colors for each cluster. Group by semantic topic similarity.`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch)
    throw new Error("Failed to parse cluster response from Claude");

  return JSON.parse(jsonMatch[0]);
}
