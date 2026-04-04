import Anthropic from "@anthropic-ai/sdk";

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
}

export function buildArticlePrompt(params: GenerationParams): string {
  return `You are an expert SEO content writer. Generate a complete, high-quality SEO-optimized blog article.

Target keyword: "${params.keyword}"
Tone: ${params.tone}
Target word count: ${params.targetWordCount} words
Brief/notes: ${params.brief || "None provided"}

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
