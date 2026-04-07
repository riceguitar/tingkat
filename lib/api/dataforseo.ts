const DATAFORSEO_BASE = "https://api.dataforseo.com/v3";

export interface DataForSeoCredentials {
  login: string;
  apiKey: string;
}

function buildAuth(login: string, apiKey: string): string {
  if (!login || !apiKey) throw new Error("DataForSEO credentials not configured");
  return Buffer.from(`${login}:${apiKey}`).toString("base64");
}

async function request<T>(path: string, body: unknown, creds: DataForSeoCredentials): Promise<T> {
  const res = await fetch(`${DATAFORSEO_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${buildAuth(creds.login, creds.apiKey)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`DataForSEO request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export interface KeywordIdeasResult {
  keyword: string;
  search_volume: number;
  difficulty: number;
  cpc: number;
  intent: string;
  competition: number;
  trend: number[];
}

export async function getKeywordIdeas(
  seedKeyword: string,
  locationCode = 2840,
  languageCode = "en",
  limit = 100,
  creds: DataForSeoCredentials = { login: process.env.DATAFORSEO_LOGIN ?? "", apiKey: process.env.DATAFORSEO_API_KEY ?? "" }
): Promise<KeywordIdeasResult[]> {
  const data = await request<{
    tasks: Array<{
      result: Array<{
        keyword: string;
        search_volume: number;
        cpc: number;
        competition: string;
        competition_index: number;
        monthly_searches: Array<{ search_volume: number }>;
      }> | null;
    }>;
  }>("/keywords_data/google_ads/keywords_for_keywords/live", [
    {
      keywords: [seedKeyword],
      location_code: locationCode,
      language_code: languageCode,
      limit,
    },
  ], creds);

  const items = data?.tasks?.[0]?.result ?? [];

  return items.map((item) => ({
    keyword: item.keyword,
    search_volume: item.search_volume ?? 0,
    difficulty: item.competition_index ?? 0,
    cpc: item.cpc ?? 0,
    intent: "informational",
    competition: item.competition_index ? item.competition_index / 100 : 0,
    trend: (item.monthly_searches ?? []).map((m) => m.search_volume),
  }));
}

export interface SerpResult {
  keyword: string;
  position: number | null;
  url: string | null;
  title: string | null;
}

// ============================================================
// Full SERP data for a single keyword (used by research pipeline)
// ============================================================
import type { SerpData, SerpOrganicItem, ExternalLinkCandidate } from "@/types/research";

export { SerpData, SerpOrganicItem, ExternalLinkCandidate };

export async function getSerpData(
  keyword: string,
  locationCode = 2840,
  languageCode = "en",
  creds: DataForSeoCredentials = { login: process.env.DATAFORSEO_LOGIN ?? "", apiKey: process.env.DATAFORSEO_API_KEY ?? "" }
): Promise<SerpData> {
  type SerpItem = {
    type: string;
    rank_absolute?: number;
    title?: string;
    url?: string;
    description?: string;
    featured_title?: string;
    featured_description?: string;
    items?: Array<{ type: string; title?: string; question?: string }>;
    search_query?: string;
    text?: string;
    source_url?: string;
  };

  type SerpRawResult = {
    items?: SerpItem[];
  };

  const [serpRaw, kwRaw] = await Promise.all([
    request<{
      tasks: Array<{ result: SerpRawResult[] | null }>;
    }>("/serp/google/organic/live/advanced", [
      {
        keyword,
        location_code: locationCode,
        language_code: languageCode,
        device: "desktop",
        depth: 10,
      },
    ], creds),
    request<{
      tasks: Array<{
        result: Array<{
          keyword: string;
          search_volume: number;
          cpc: number;
          competition_index: number;
        }> | null;
      }>;
    }>("/keywords_data/google_ads/search_volume/live", [
      {
        keywords: [keyword],
        location_code: locationCode,
        language_code: languageCode,
      },
    ], creds),
  ]);

  const items: SerpItem[] = serpRaw?.tasks?.[0]?.result?.[0]?.items ?? [];

  const organic: SerpOrganicItem[] = items
    .filter((i) => i.type === "organic")
    .slice(0, 10)
    .map((i, idx) => ({
      rank: i.rank_absolute ?? idx + 1,
      title: i.title ?? "",
      url: i.url ?? "",
      description: i.description ?? "",
    }));

  const paa: string[] = items
    .filter((i) => i.type === "people_also_ask")
    .flatMap((i) => (i.items ?? []).map((q) => q.question ?? q.title ?? "").filter(Boolean))
    .slice(0, 10);

  const featuredItem = items.find((i) => i.type === "featured_snippet");
  const featured_snippet = featuredItem
    ? {
        text: featuredItem.featured_description ?? featuredItem.description ?? "",
        url: featuredItem.source_url ?? featuredItem.url ?? "",
      }
    : null;

  const relatedItem = items.find((i) => i.type === "related_searches");
  const related_searches: string[] = relatedItem
    ? (relatedItem.items ?? []).map((r) => r.title ?? "").filter(Boolean)
    : [];

  // Rough word-count proxy: description length × 10, capped at 4000
  const topFive = organic.slice(0, 5);
  const avg_competitor_word_count =
    topFive.length > 0
      ? Math.round(
          topFive.reduce((sum, o) => sum + Math.min((o.description.split(/\s+/).length) * 10, 4000), 0) /
            topFive.length
        )
      : 1500;

  let kwResult = kwRaw?.tasks?.[0]?.result?.[0];

  // Fallback: if search_volume/live returned nothing (common for niche keywords with no Google Ads data),
  // try keywords_for_keywords and find the exact match within the returned set.
  if (!kwResult || (!kwResult.search_volume && !kwResult.cpc)) {
    try {
      const fallbackRaw = await request<{
        tasks: Array<{
          result: Array<{
            keyword: string;
            search_volume: number;
            cpc: number;
            competition_index: number;
          }> | null;
        }>;
      }>("/keywords_data/google_ads/keywords_for_keywords/live", [
        {
          keywords: [keyword],
          location_code: locationCode,
          language_code: languageCode,
          limit: 50,
        },
      ], creds);
      const fallbackItems = fallbackRaw?.tasks?.[0]?.result ?? [];
      const normalised = keyword.toLowerCase().trim();
      const exactMatch = fallbackItems.find((r) => r.keyword?.toLowerCase().trim() === normalised);
      if (exactMatch) kwResult = exactMatch;
    } catch {
      // ignore fallback failure
    }
  }

  const keyword_metrics = {
    volume: kwResult?.search_volume ?? 0,
    difficulty: kwResult?.competition_index ?? 0,
    cpc: kwResult?.cpc ?? 0,
  };

  return { organic, paa, featured_snippet, related_searches, avg_competitor_word_count, keyword_metrics };
}

// ============================================================
// Content analysis — finds authoritative external sources
// ============================================================
export async function getContentAnalysis(
  query: string,
  locationCode = 2840,
  creds: DataForSeoCredentials = { login: process.env.DATAFORSEO_LOGIN ?? "", apiKey: process.env.DATAFORSEO_API_KEY ?? "" }
): Promise<ExternalLinkCandidate[]> {
  type ContentItem = {
    url?: string;
    title?: string;
    domain?: string;
    snippet?: string;
    description?: string;
  };

  const data = await request<{
    tasks: Array<{
      result: Array<{ items?: ContentItem[] }> | null;
    }>;
  }>("/content_analysis/search/live", [
    {
      keyword: query,
      location_code: locationCode,
      limit: 15,
      filters: [["domain_rank", ">", 50]],
    },
  ], creds);

  const items: ContentItem[] = data?.tasks?.[0]?.result?.[0]?.items ?? [];

  // Deduplicate by domain, keep highest-ranked per domain, return top 8
  const seen = new Set<string>();
  const results: ExternalLinkCandidate[] = [];

  for (const item of items) {
    const domain = item.domain ?? new URL(item.url ?? "https://unknown").hostname;
    if (seen.has(domain)) continue;
    seen.add(domain);
    results.push({
      url: item.url ?? "",
      title: item.title ?? "",
      domain,
      citation_context: item.snippet ?? item.description ?? "",
    });
    if (results.length >= 8) break;
  }

  return results;
}

export interface SerpPositionResult extends SerpResult {
  local_pack_position: number | null;
  local_pack_present: boolean;
}

export async function getSerpPositions(
  domain: string,
  keywords: string[],
  locationCode = 2840,
  languageCode = "en",
  device: "desktop" | "mobile" = "desktop",
  creds: DataForSeoCredentials = { login: process.env.DATAFORSEO_LOGIN ?? "", apiKey: process.env.DATAFORSEO_API_KEY ?? "" }
): Promise<SerpPositionResult[]> {
  const tasks = keywords.map((keyword) => ({
    keyword,
    location_code: locationCode,
    language_code: languageCode,
    device,
    depth: 100,
  }));

  const data = await request<{
    tasks: Array<{
      data: { keyword: string };
      result: Array<{
        items: Array<{
          type: string;
          rank_absolute: number;
          url: string;
          title: string;
          items?: Array<{ type: string; domain?: string; url?: string }>;
        }>;
      }> | null;
    }>;
  }>("/serp/google/organic/live/advanced", tasks, creds);

  return (data?.tasks ?? []).map((task) => {
    const keyword = task.data?.keyword ?? "";
    const items = task.result?.[0]?.items ?? [];

    const domainItem = items.find(
      (item) =>
        item.type === "organic" &&
        item.url &&
        item.url.includes(domain)
    );

    // Local pack: items of type "local_pack" contain sub-items listing businesses
    const localPackItem = items.find((item) => item.type === "local_pack");
    const localPackPresent = !!localPackItem;
    let localPackPosition: number | null = null;

    if (localPackItem?.items) {
      const idx = localPackItem.items.findIndex(
        (sub) => (sub.domain && sub.domain.includes(domain)) || (sub.url && sub.url.includes(domain))
      );
      if (idx !== -1) localPackPosition = idx + 1; // 1-indexed position within pack
    }

    return {
      keyword,
      position: domainItem?.rank_absolute ?? null,
      url: domainItem?.url ?? null,
      title: domainItem?.title ?? null,
      local_pack_position: localPackPosition,
      local_pack_present: localPackPresent,
    };
  });
}
