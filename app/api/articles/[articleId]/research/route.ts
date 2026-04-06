import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  const { articleId } = await params;
  const supabase = await createClient();

  const [articleResult, researchResult] = await Promise.all([
    supabase
      .from("articles")
      .select("primary_keyword, tone, target_word_count")
      .eq("id", articleId)
      .single(),
    supabase
      .from("article_research")
      .select("serp_data, internal_links, external_links, competition_analysis, writing_plan")
      .eq("article_id", articleId)
      .single(),
  ]);

  if (articleResult.error) {
    return NextResponse.json({ error: articleResult.error.message }, { status: 404 });
  }

  return NextResponse.json({
    article: articleResult.data,
    research: researchResult.data ?? null,
  });
}
