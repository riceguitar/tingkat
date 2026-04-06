import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const q = req.nextUrl.searchParams.get("q");
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50"), 200);

  const supabase = await createClient();

  let query = supabase
    .from("sitemap_pages")
    .select("id, url, title, description, h1")
    .eq("project_id", params.projectId)
    .limit(limit);

  if (q) {
    query = query.or(`title.ilike.%${q}%,h1.ilike.%${q}%,description.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
