import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { subDays, format } from "date-fns";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const supabase = await createClient();
  const from = format(subDays(new Date(), 90), "yyyy-MM-dd");

  // Aggregate gsc_snapshots for position 11-30 with meaningful impressions
  const { data: rows } = await supabase
    .from("gsc_snapshots")
    .select("query, clicks, impressions, position")
    .eq("project_id", projectId)
    .gte("snapshot_date", from)
    .gte("position", 11)
    .lte("position", 30);

  if (!rows || rows.length === 0) return NextResponse.json({ quickWins: [] });

  // Aggregate by query
  const queryMap = new Map<string, { clicks: number; impressions: number; position_sum: number; count: number }>();
  for (const row of rows) {
    const existing = queryMap.get(row.query);
    if (existing) {
      existing.clicks += row.clicks;
      existing.impressions += row.impressions;
      existing.position_sum += row.position ?? 0;
      existing.count += 1;
    } else {
      queryMap.set(row.query, {
        clicks: row.clicks,
        impressions: row.impressions,
        position_sum: row.position ?? 0,
        count: 1,
      });
    }
  }

  // Filter: impressions > 100
  const candidates = Array.from(queryMap.entries())
    .filter(([, agg]) => agg.impressions > 100)
    .map(([query, agg]) => ({
      query,
      clicks: agg.clicks,
      impressions: agg.impressions,
      avg_position: agg.count > 0 ? Math.round((agg.position_sum / agg.count) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 50);

  if (candidates.length === 0) return NextResponse.json({ quickWins: [] });

  // Exclude queries that already have a published article targeting them
  const { data: publishedArticles } = await supabase
    .from("articles")
    .select("primary_keyword, title")
    .eq("project_id", projectId)
    .eq("status", "published")
    .not("primary_keyword", "is", null);

  const coveredKeywords = new Set(
    (publishedArticles ?? []).map((a) => (a.primary_keyword ?? "").toLowerCase())
  );

  const quickWins = candidates
    .filter((c) => !coveredKeywords.has(c.query.toLowerCase()))
    .slice(0, 20);

  return NextResponse.json({ quickWins });
}
