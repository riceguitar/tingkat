import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const supabase = await createClient();

  let query = supabase
    .from("keyword_clusters")
    .select("*, keywords(id, keyword, search_volume, difficulty, intent)")
    .order("created_at", { ascending: false });

  if (projectId) query = query.eq("project_id", projectId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();

  const { data, error } = await supabase
    .from("keyword_clusters")
    .insert({
      project_id: body.projectId,
      name: body.name,
      color: body.color ?? "#6366f1",
      intent: body.intent ?? null,
      description: body.description ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
