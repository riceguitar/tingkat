import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; sitemapId: string }> }
) {
  const { projectId, sitemapId } = await params;
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_sitemaps")
    .delete()
    .eq("id", sitemapId)
    .eq("project_id", projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
