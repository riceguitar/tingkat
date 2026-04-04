import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createPillarSchema = z.object({
  url: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  target_keyword: z.string().max(200).optional(),
});

const bulkCreateSchema = z.object({
  pillars: z.array(createPillarSchema).min(1).max(50),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pillar_pages")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const supabase = await createClient();
  const body = await req.json();

  // Support both single pillar and bulk create
  if (body.pillars) {
    const parsed = bulkCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const rows = parsed.data.pillars.map((p) => ({
      project_id: projectId,
      url: p.url,
      title: p.title,
      description: p.description ?? null,
      target_keyword: p.target_keyword ?? null,
    }));

    const { data, error } = await supabase
      .from("pillar_pages")
      .insert(rows)
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  const parsed = createPillarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("pillar_pages")
    .insert({
      project_id: projectId,
      url: parsed.data.url,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      target_keyword: parsed.data.target_keyword ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
