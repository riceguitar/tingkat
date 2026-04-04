import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveKeywordsSchema } from "@/lib/validations/keyword";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const supabase = await createClient();

  let query = supabase
    .from("keywords")
    .select("*, keyword_clusters(id, name, color)")
    .order("search_volume", { ascending: false });

  if (projectId) query = query.eq("project_id", projectId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();
  const parsed = saveKeywordsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const rows = parsed.data.keywords.map((k) => ({
    project_id: parsed.data.projectId,
    keyword: k.keyword,
    cluster_id: k.clusterId ?? null,
    search_volume: k.searchVolume ?? null,
    difficulty: k.difficulty ?? null,
    cpc: k.cpc ?? null,
    intent: k.intent ?? null,
    competition: k.competition ?? null,
    trend: k.trend ?? null,
  }));

  const { data, error } = await supabase
    .from("keywords")
    .upsert(rows, { onConflict: "project_id,keyword" })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
