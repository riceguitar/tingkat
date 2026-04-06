import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const urls: string[] = [];
  try {
    const res = await fetch(sitemapUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TingkatBot/1.0)" },
    });
    if (!res.ok) return urls;

    const text = await res.text();
    const locs = [...text.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)].map((m) => m[1].trim());
    if (!locs.length) return urls;

    // Sitemap index — recursively fetch up to 5 child sitemaps
    if (text.includes("<sitemapindex")) {
      for (const childUrl of locs.slice(0, 5)) {
        try {
          const child = await fetch(childUrl, {
            signal: AbortSignal.timeout(8000),
            headers: { "User-Agent": "Mozilla/5.0 (compatible; TingkatBot/1.0)" },
          });
          if (!child.ok) continue;
          const childText = await child.text();
          const childLocs = [...childText.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)].map((m) => m[1].trim());
          urls.push(...childLocs);
        } catch { /* skip */ }
      }
    } else {
      urls.push(...locs);
    }
  } catch { /* ignore */ }

  return urls;
}

async function fetchPageMeta(url: string): Promise<{ title: string | null; description: string | null; h1: string | null }> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TingkatBot/1.0)" },
    });
    if (!res.ok) return { title: null, description: null, h1: null };

    const html = await res.text();
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null;
    const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]?.trim() ?? null;
    const h1 = html.match(/<h1[^>]*>([^<]*)<\/h1>/i)?.[1]?.trim() ?? null;
    return { title, description, h1 };
  } catch {
    return { title: null, description: null, h1: null };
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; sitemapId: string }> }
) {
  const { projectId, sitemapId } = await params;
  const supabase = await createClient();

  const { data: sitemap, error: sErr } = await supabase
    .from("project_sitemaps")
    .select("id, url, project_id")
    .eq("id", sitemapId)
    .eq("project_id", projectId)
    .single();

  if (sErr || !sitemap) return NextResponse.json({ error: "Sitemap not found" }, { status: 404 });

  const allUrls = await fetchSitemapUrls(sitemap.url);
  const uniqueUrls = [...new Set(allUrls)].slice(0, 2000);

  const pages: Array<{ project_id: string; sitemap_id: string; url: string; title: string | null; description: string | null; h1: string | null; last_fetched_at: string }> = [];
  const batchSize = 10;
  for (let i = 0; i < uniqueUrls.length; i += batchSize) {
    const batch = uniqueUrls.slice(i, i + batchSize);
    const metas = await Promise.all(batch.map((u) => fetchPageMeta(u)));
    for (let j = 0; j < batch.length; j++) {
      pages.push({
        project_id: projectId,
        sitemap_id: sitemapId,
        url: batch[j],
        ...metas[j],
        last_fetched_at: new Date().toISOString(),
      });
    }
  }

  for (let i = 0; i < pages.length; i += 100) {
    await supabase
      .from("sitemap_pages")
      .upsert(pages.slice(i, i + 100), { onConflict: "project_id,url" });
  }

  await supabase
    .from("project_sitemaps")
    .update({ last_crawled_at: new Date().toISOString(), page_count: pages.length })
    .eq("id", sitemapId);

  return NextResponse.json({ crawled: pages.length, sitemapId });
}
