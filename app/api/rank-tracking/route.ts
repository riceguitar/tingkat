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

  return NextResponse.json({ snapshots: data });
}
