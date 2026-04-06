import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { subDays, format } from "date-fns";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("projectId");
  const days = parseInt(searchParams.get("days") ?? "28", 10);

  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const supabase = await createClient();
  const from = format(subDays(new Date(), days), "yyyy-MM-dd");

  // Top queries (sorted by clicks desc) for the period
  const { data: rawRows } = await supabase
    .from("gsc_snapshots")
    .select("query, clicks, impressions, ctr, position")
    .eq("project_id", projectId)
    .gte("snapshot_date", from);

  if (!rawRows) {
    return NextResponse.json({ topQueries: [], byKeyword: {} });
  }

  // Aggregate by query
  const queryMap = new Map<string, { clicks: number; impressions: number; ctr_sum: number; position_sum: number; count: number }>();
  for (const row of rawRows) {
    const existing = queryMap.get(row.query);
    if (existing) {
      existing.clicks += row.clicks;
      existing.impressions += row.impressions;
      existing.ctr_sum += row.ctr ?? 0;
      existing.position_sum += row.position ?? 0;
      existing.count += 1;
    } else {
      queryMap.set(row.query, {
        clicks: row.clicks,
        impressions: row.impressions,
        ctr_sum: row.ctr ?? 0,
        position_sum: row.position ?? 0,
        count: 1,
      });
    }
  }

  const topQueries = Array.from(queryMap.entries())
    .map(([query, agg]) => ({
      query,
      clicks: agg.clicks,
      impressions: agg.impressions,
      ctr: agg.count > 0 ? agg.ctr_sum / agg.count : 0,
      position: agg.count > 0 ? agg.position_sum / agg.count : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 100);

  // byKeyword map for rank-tracking overlay
  const byKeyword: Record<string, { clicks: number; impressions: number; position: number }> = {};
  for (const [query, agg] of queryMap.entries()) {
    byKeyword[query] = {
      clicks: agg.clicks,
      impressions: agg.impressions,
      position: agg.count > 0 ? agg.position_sum / agg.count : 0,
    };
  }

  return NextResponse.json({ topQueries, byKeyword });
}
