const DATAFORSEO_BASE = "https://api.dataforseo.com/v3";

function getAuth(): string {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_API_KEY;
  if (!login || !password) throw new Error("DataForSEO credentials not configured");
  return Buffer.from(`${login}:${password}`).toString("base64");
}

async function request<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${DATAFORSEO_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${getAuth()}`,
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
  limit = 100
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
  ]);

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

export async function getSerpPositions(
  domain: string,
  keywords: string[],
  locationCode = 2840,
  languageCode = "en",
  device: "desktop" | "mobile" = "desktop"
): Promise<SerpResult[]> {
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
        }>;
      }> | null;
    }>;
  }>("/serp/google/organic/live/advanced", tasks);

  return (data?.tasks ?? []).map((task) => {
    const keyword = task.data?.keyword ?? "";
    const items = task.result?.[0]?.items ?? [];
    const domainItem = items.find(
      (item) =>
        item.type === "organic" &&
        item.url &&
        item.url.includes(domain)
    );

    return {
      keyword,
      position: domainItem?.rank_absolute ?? null,
      url: domainItem?.url ?? null,
      title: domainItem?.title ?? null,
    };
  });
}
