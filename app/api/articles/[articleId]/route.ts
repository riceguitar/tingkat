import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateArticleSchema } from "@/lib/validations/article";
import { slugify } from "@/lib/utils";

export async function GET(_: NextRequest, { params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*, projects(name, domain), keywords(keyword)")
    .eq("id", articleId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;
  const supabase = await createClient();
  const body = await req.json();
  const parsed = updateArticleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Auto-generate slug from title if title changed and no explicit slug
  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.title && !parsed.data.slug) {
    updates.slug = slugify(parsed.data.title);
  }

  const { data, error } = await supabase
    .from("articles")
    .update(updates)
    .eq("id", articleId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("articles").delete().eq("id", articleId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
