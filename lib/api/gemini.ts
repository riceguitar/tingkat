import Anthropic from "@anthropic-ai/sdk";
import type {
  SerpData,
  InternalLinkCandidate,
  ExternalLinkCandidate,
  CompetitionAnalysis,
} from "@/types/research";

export const MODEL = "claude-sonnet-4-5";

export interface AnthropicCredentials {
  apiKey: string;
}

function getClient(apiKey: string): Anthropic {
  if (!apiKey) throw new Error("Anthropic API key is not configured");
  return new Anthropic({ apiKey });
}

// ============================================================
// Local SEO context (shared between generation and research)
// ============================================================
export interface LocalContext {
  businessName?: string | null;
  businessType?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  serviceAreas?: string[];
  napAddress?: string | null;
  napPhone?: string | null;
  primaryCategory?: string | null;
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
  contentFormat?: string;
  audienceLevel?: string;
  pointOfView?: string;
  localContext?: LocalContext | null;
}

export function buildArticlePrompt(params: GenerationParams): string {
  const pillarContext = params.pillar
    ? `\nSupporting pillar page: "${params.pillar.title}" (${params.pillar.url})
This blog post should naturally support and internally link to the above pillar page.`
    : "";

  const simpleFormatLabels: Record<string, string> = {
    "how-to-guide": "How-To Guide (step-by-step, numbered steps)",
    "listicle": "Listicle (numbered/bulleted list as primary structure)",
    "comparison": "Comparison / Best-of (compare options, include a comparison table)",
    "case-study": "Case Study (problem → solution → results)",
    "opinion": "Opinion / Thought Leadership",
    "ultimate-guide": "Ultimate Guide (comprehensive, end-to-end coverage)",
  };
  const formatLine = simpleFormatLabels[params.contentFormat ?? ""] ? `\nContent format: ${simpleFormatLabels[params.contentFormat!]}` : "";
  const audienceLine = params.audienceLevel ? `\nAudience level: ${params.audienceLevel}` : "";
  const povLine = params.pointOfView ? `\nPoint of view: ${params.pointOfView.replace(/-/g, " ")}` : "";

  const lc = params.localContext;
  const localBlock = lc?.city
    ? `\n\nBUSINESS CONTEXT:\nBusiness: ${lc.businessName ?? "the business"} — ${lc.primaryCategory ?? lc.businessType ?? "local business"} in ${lc.city}${lc.stateProvince ? `, ${lc.stateProvince}` : ""}\n${lc.serviceAreas?.length ? `Service areas: ${lc.serviceAreas.join(", ")}\n` : ""}${lc.napAddress ? `Address: ${lc.napAddress}\n` : ""}${lc.napPhone ? `Phone: ${lc.napPhone}\n` : ""}LOCAL SEO REQUIREMENTS:\n- Naturally weave "${lc.city}" and service area names into the article\n- Include the business name where contextually appropriate\n- Structure one section as a local service area overview`
    : "";

  return `You are an expert SEO content writer. Generate a complete, high-quality SEO-optimized blog article.

Target keyword: "${params.keyword}"
Tone: ${params.tone}${formatLine}${audienceLine}${povLine}
Target word count: ${params.targetWordCount} words — write exactly this many words, do not exceed
Brief/notes: ${params.brief || "None provided"}${pillarContext}${localBlock}

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
Include the target keyword naturally throughout. Write approximately ${params.targetWordCount} words — do not significantly exceed this.
Include a compelling introduction, well-structured body sections, and a conclusion.
</article>`;
}

// ============================================================
// Streaming article generation — returns an async generator
// of text chunks
// ============================================================
export async function* streamArticle(
  prompt: string,
  targetWordCount = 1500,
  creds: AnthropicCredentials = { apiKey: process.env.ANTHROPIC_API_KEY ?? "" }
): AsyncGenerator<string> {
  const client = getClient(creds.apiKey);
  const max_tokens = Math.min(Math.ceil(targetWordCount * 1.4) + 800, 8192);

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens,
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
  candidates: InternalLinkSource[],
  creds: AnthropicCredentials = { apiKey: process.env.ANTHROPIC_API_KEY ?? "" }
): Promise<InternalLinkCandidate[]> {
  if (candidates.length === 0) return [];
  const client = getClient(creds.apiKey);

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
  clusterKeywords: string[],
  creds: AnthropicCredentials = { apiKey: process.env.ANTHROPIC_API_KEY ?? "" }
): Promise<CompetitionAnalysis> {
  const client = getClient(creds.apiKey);

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
  params: WritingPlanParams,
  creds: AnthropicCredentials = { apiKey: process.env.ANTHROPIC_API_KEY ?? "" }
): AsyncGenerator<string> {
  const client = getClient(creds.apiKey);

  const internalLinkList = params.internalLinks
    .slice(0, 6)
    .map((l) => `- "${l.suggested_anchor_text}" → ${l.url} (${l.title})`)
    .join("\n") || "None available";

  const externalLinkList = params.externalLinks
    .slice(0, 6)
    .map((l) => `- ${l.domain}: ${l.title} (${l.citation_context})`)
    .join("\n") || "None available";

  const paaList = params.serpData.paa.slice(0, 8).map((q) => `- ${q}`).join("\n") || "None found";

  const prompt = `You are an SEO content strategist. Produce a compact article outline — not a writer's brief. The outline will be fed directly into an article generator, so brevity is critical. Total output must be under 400 words.

PRIMARY KEYWORD: "${params.primaryKeyword}"
TONE: ${params.tone} | TARGET: ${params.targetWordCount} words
UNIQUE ANGLE: ${params.competitionAnalysis.unique_angle}
FEATURED SNIPPET TARGET: ${params.competitionAnalysis.featured_snippet_opportunity}

Output ONLY this structure (no extra commentary):

## [H1 title — include primary keyword]
**Meta:** [150-160 char meta description]
**Schema:** [Article | FAQPage | HowTo | Article+FAQPage]

### Sections
[List each section as a single line: ## Heading — one-sentence topic note. Add "· link: [anchor]→URL" only if an internal link belongs here.]
${internalLinkList !== "None available" ? `\nINTERNAL LINKS AVAILABLE:\n${internalLinkList}` : ""}
${externalLinkList !== "None available" ? `\nEXTERNAL SOURCES:\n${externalLinkList}` : ""}

### FAQ
${paaList}

### EEAT
[2-3 lines: practitioner angle, one [STAT: ...] placeholder to include, featured snippet section name]`;

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 1500,
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
  contentFormat?: string;
  audienceLevel?: string;
  pointOfView?: string;
  localContext?: LocalContext | null;
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

  const formatLabels: Record<string, string> = {
    "ultimate-guide": "Ultimate Guide (comprehensive, authoritative, covers topic end-to-end)",
    "how-to-guide": "How-To Guide (step-by-step instructions, numbered steps, practical focus)",
    "listicle": "Listicle (numbered or bulleted list as the primary structure, e.g. '10 best X')",
    "comparison": "Comparison / Best-of (evaluate and compare options, include a comparison table)",
    "case-study": "Case Study (real or representative example, problem → solution → results structure)",
    "opinion": "Opinion / Thought Leadership (author's informed perspective, backed by evidence)",
  };
  const audienceLabels: Record<string, string> = {
    "beginner": "Beginner (no assumed prior knowledge, explain jargon, use analogies)",
    "intermediate": "Intermediate (some familiarity assumed, skip basics, focus on nuance)",
    "expert": "Expert / Advanced (deep technical detail, skip fundamentals entirely)",
  };
  const povLabels: Record<string, string> = {
    "second-person": "second person — address the reader as 'you' / 'your'",
    "first-person-plural": "first person plural — use 'we' / 'our' (brand voice)",
    "first-person-singular": "first person singular — use 'I' / 'my' (personal author voice)",
    "third-person": "third person — refer to 'the reader' / 'businesses' / 'users'",
  };

  const formatNote = formatLabels[params.contentFormat ?? ""] ? `\nCONTENT FORMAT: ${formatLabels[params.contentFormat!]}` : "";
  const audienceNote = audienceLabels[params.audienceLevel ?? ""] ? `\nAUDIENCE: ${audienceLabels[params.audienceLevel!]}` : "";
  const povNote = povLabels[params.pointOfView ?? ""] ? `\nPOINT OF VIEW: ${povLabels[params.pointOfView!]}` : "";

  const lc = params.localContext;
  const localBlock = lc?.city
    ? `\nBUSINESS CONTEXT:\nBusiness: ${lc.businessName ?? "the business"} — ${lc.primaryCategory ?? lc.businessType ?? "local business"} in ${lc.city}${lc.stateProvince ? `, ${lc.stateProvince}` : ""}\n${lc.serviceAreas?.length ? `Service areas: ${lc.serviceAreas.join(", ")}\n` : ""}${lc.napAddress ? `Address: ${lc.napAddress}\n` : ""}${lc.napPhone ? `Phone: ${lc.napPhone}\n` : ""}LOCAL SEO REQUIREMENTS:\n- Naturally weave "${lc.city}" and service area names throughout the article\n- Reference the business name where contextually appropriate\n- Include a dedicated section covering service areas\n- Schema markup must use LocalBusiness type (see schema block below)`
    : "";

  const localBusinessSchemaNode = lc?.city
    ? `,\n    {\n      "@type": "${lc.primaryCategory ?? "LocalBusiness"}",\n      "name": "${lc.businessName ?? ""}",\n      "areaServed": [${(lc.serviceAreas ?? [lc.city]).map((a) => `"${a}"`).join(", ")}]${lc.napAddress ? `,\n      "address": { "@type": "PostalAddress", "streetAddress": "${lc.napAddress}" }` : ""}${lc.napPhone ? `,\n      "telephone": "${lc.napPhone}"` : ""}\n    }`
    : "";

  return `You are an expert SEO content writer with deep practitioner experience. Write a complete, EEAT-optimised article following the plan and research below.

PRIMARY KEYWORD: "${params.primaryKeyword}"
TONE: ${params.tone}${formatNote}${audienceNote}${povNote}
TARGET WORD COUNT: ${params.targetWordCount} words. Write exactly ${params.targetWordCount} words in the <article> block. Stop when you reach ${params.targetWordCount} words. Do not pad or add extra sections to reach a longer length. (Competitor average: ${params.serpData.avg_competitor_word_count} words — noted for context only.)
BRIEF: ${params.brief || "None"}${pillarContext}${localBlock}

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
    }${localBusinessSchemaNode}
  ]
}
</schema>

<outline>
[{"level": 1, "text": "H1 Title"}, {"level": 2, "text": "Section"}, {"level": 3, "text": "Subsection"}]
</outline>

<article>
Full markdown article. Use proper heading hierarchy (# H1, ## H2, ### H3).
Write exactly ${params.targetWordCount} words. Stop at ${params.targetWordCount} words even if sections feel incomplete. Do not pad.
Include all internal links as markdown [anchor text](url).
Include all external citations as markdown [source name](url).
Include a ## Frequently Asked Questions section with H3 for each question.
After each major H2 section, insert one image placeholder on its own line: [IMAGE: brief alt-text description of a relevant image for this section]. Include 3–5 image placeholders total.
</article>`;
}

export async function* streamResearchArticle(
  params: ResearchArticleParams,
  creds: AnthropicCredentials = { apiKey: process.env.ANTHROPIC_API_KEY ?? "" }
): AsyncGenerator<string> {
  const prompt = buildResearchArticlePrompt(params);
  const client = getClient(creds.apiKey);

  // Hard ceiling: ~1.4 tokens/word + 800 tokens for meta/schema/outline wrappers
  const max_tokens = Math.min(Math.ceil(params.targetWordCount * 1.4) + 800, 16000);

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens,
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
  maxClusters = 8,
  creds: AnthropicCredentials = { apiKey: process.env.ANTHROPIC_API_KEY ?? "" }
): Promise<ClusterResult[]> {
  const client = getClient(creds.apiKey);

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
