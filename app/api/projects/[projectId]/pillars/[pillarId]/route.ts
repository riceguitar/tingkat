import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; pillarId: string }> }
) {
  const { projectId, pillarId } = await params;
  const supabase = await createClient();
  const body = await req.json();

  const updates: Record<string, unknown> = {};
  if (body.url !== undefined) updates.url = body.url;
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.target_keyword !== undefined) updates.target_keyword = body.target_keyword;

  const { data, error } = await supabase
    .from("pillar_pages")
    .update(updates)
    .eq("id", pillarId)
    .eq("project_id", projectId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; pillarId: string }> }
) {
  const { projectId, pillarId } = await params;
  const supabase = await createClient();

  const { error } = await supabase
    .from("pillar_pages")
    .delete()
    .eq("id", pillarId)
    .eq("project_id", projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
