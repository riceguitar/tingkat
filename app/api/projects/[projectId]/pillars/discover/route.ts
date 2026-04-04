import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const NON_PILLAR_PATTERNS = [
  /\/blog\//i, /\/news\//i, /\/posts?\//i, /\/articles?\//i,
  /\/tag\//i, /\/tags\//i, /\/category\//i, /\/categories\//i,
  /\/author\//i, /\/authors\//i, /\/feed\//i, /\/?feed$/i,
  /\/page\/\d+/i, /\/\d{4}\/\d{2}\//i,
  /\.(xml|rss|json|txt|pdf)$/i,
  /\/wp-/i, /\/admin/i, /\/login/i, /\/register/i, /\/cart/i,
  /\/checkout/i, /\/account/i, /\/search/i, /\/404/i,
  /[?#]/,
];

function isPillarCandidate(url: string): boolean {
  return !NON_PILLAR_PATTERNS.some((re) => re.test(url));
}

async function fetchSitemap(domain: string): Promise<string[]> {
  const base = domain.startsWith("http") ? domain : `https://${domain}`;
  const attempts = [`${base}/sitemap.xml`, `${base}/sitemap_index.xml`, `${base}/sitemap/`];
  const urls: string[] = [];

  for (const sitemapUrl of attempts) {
    try {
      const res = await fetch(sitemapUrl, {
        signal: AbortSignal.timeout(6000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; TingkatBot/1.0)" },
      });
      if (!res.ok) continue;

      const text = await res.text();
      // Extract <loc> tags from both sitemap and sitemap index
      const locs = [...text.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)].map((m) => m[1]);
      if (!locs.length) continue;

      // If it's a sitemap index, recursively fetch child sitemaps (max 3)
      if (text.includes("<sitemapindex")) {
        const childUrls = locs.slice(0, 3);
        for (const childUrl of childUrls) {
          try {
            const childRes = await fetch(childUrl, {
              signal: AbortSignal.timeout(5000),
              headers: { "User-Agent": "Mozilla/5.0 (compatible; TingkatBot/1.0)" },
            });
            if (!childRes.ok) continue;
            const childText = await childRes.text();
            const childLocs = [...childText.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)].map((m) => m[1]);
            urls.push(...childLocs);
          } catch {}
        }
      } else {
        urls.push(...locs);
      }

      if (urls.length > 0) break;
    } catch {}
  }

  return urls;
}

async function fetchNavLinks(domain: string): Promise<string[]> {
  const base = domain.startsWith("http") ? domain : `https://${domain}`;
  try {
    const res = await fetch(base, {
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TingkatBot/1.0)" },
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Extract hrefs from <nav> and <header> elements
    const navMatch = html.match(/<(?:nav|header)[^>]*>([\s\S]*?)<\/(?:nav|header)>/gi) ?? [];
    const hrefs: string[] = [];
    for (const block of navMatch) {
      const links = [...block.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
      hrefs.push(...links);
    }

    // Resolve relative URLs and filter to same domain
    return hrefs
      .map((href) => {
        if (href.startsWith("http")) return href;
        if (href.startsWith("/")) return `${base}${href}`;
        return null;
      })
      .filter((url): url is string => url !== null && url.includes(domain.replace(/^https?:\/\//, "")));
  } catch {
    return [];
  }
}

async function classifyWithClaude(
  urls: string[],
  domain: string
): Promise<Array<{ url: string; title: string; description: string; confidence: "high" | "medium" | "low" }>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic({ apiKey });

  const urlList = urls.slice(0, 80).join("\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are an SEO strategist. Analyze these URLs from ${domain} and identify which are "pillar pages" — the main service, product, or core topic pages that the site wants to rank for competitive keywords.

Pillar pages are typically:
- Main service or product pages (e.g. /services/seo, /pricing, /about)
- Core category or topic pages
- High-intent pages the business values most

NOT pillar pages: blog posts, news articles, tag/category archives, author pages, legal/admin pages.

URLs to analyze:
${urlList}

Return ONLY valid JSON — an array of pillar page objects:
[
  {
    "url": "full URL",
    "title": "concise descriptive title for this page topic",
    "description": "1 sentence describing what this page is about and what keyword theme it targets",
    "confidence": "high|medium|low"
  }
]

Only include pages you are confident are pillar/service pages. Omit anything that looks like a blog post, archive, or utility page. Return an empty array if none qualify.`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("domain")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const domain = project.domain;
  let allUrls: string[] = [];

  // 1. Try sitemap
  const sitemapUrls = await fetchSitemap(domain);
  allUrls.push(...sitemapUrls);

  // 2. If sitemap failed/empty, fall back to nav links
  if (allUrls.length === 0) {
    const navLinks = await fetchNavLinks(domain);
    allUrls.push(...navLinks);
  }

  // 3. Also pull top GSC pages by clicks (if available)
  const { data: gscPages } = await supabase
    .from("gsc_snapshots")
    .select("page")
    .eq("project_id", projectId)
    .not("page", "is", null)
    .order("clicks", { ascending: false })
    .limit(30);

  if (gscPages) {
    const gscUrls = gscPages.map((r) => r.page).filter(Boolean) as string[];
    allUrls.push(...gscUrls);
  }

  // Deduplicate and filter
  const candidateUrls = [...new Set(allUrls)].filter(isPillarCandidate);

  if (candidateUrls.length === 0) {
    return NextResponse.json({
      suggestions: [],
      message: "No pages found. Make sure the domain is correct and the site is accessible.",
    });
  }

  const suggestions = await classifyWithClaude(candidateUrls, domain);

  return NextResponse.json({ suggestions, scanned: candidateUrls.length });
}
