import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("projectId");
  const keywordId = searchParams.get("keywordId");
  const from = searchParams.get("from") ?? new Date(Date.now() - 30 * 86400_000).toISOString().split("T")[0];
  const to = searchParams.get("to") ?? new Date().toISOString().split("T")[0];

  const supabase = await createClient();
  let query = supabase
    .from("rank_snapshots")
    .select("*, keywords(keyword)")
    .gte("snapshot_date", from)
    .lte("snapshot_date", to)
    .order("snapshot_date", { ascending: true });

  if (projectId) query = query.eq("project_id", projectId);
  if (keywordId) query = query.eq("keyword_id", keywordId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch latest local pack snapshot per keyword for the project
  let localPackLatest: Array<{ keyword_id: string; position: number | null; pack_present: boolean }> = [];
  if (projectId) {
    const { data: lpData } = await supabase
      .from("local_pack_snapshots")
      .select("keyword_id, position, pack_present, snapshot_date")
      .eq("project_id", projectId)
      .order("snapshot_date", { ascending: false });

    if (lpData) {
      // Keep only the latest entry per keyword_id
      const seen = new Set<string>();
      for (const row of lpData) {
        if (!row.keyword_id || seen.has(row.keyword_id)) continue;
        seen.add(row.keyword_id);
        localPackLatest.push({ keyword_id: row.keyword_id, position: row.position, pack_present: row.pack_present });
      }
    }
  }

  return NextResponse.json({ snapshots: data, localPack: localPackLatest });
}
