import { NextRequest, NextResponse } from "next/server";
import { buildArticlePrompt, streamArticle } from "@/lib/api/gemini";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { keyword, brief, tone, targetWordCount, projectId, articleId, pillarPageId } = body;

  if (!keyword || !projectId) {
    return NextResponse.json({ error: "keyword and projectId are required" }, { status: 400 });
  }

  const supabase = await createClient();

  // Fetch project local profile and pillar page in parallel
  const [projectRes, pillarRes] = await Promise.all([
    supabase
      .from("projects")
      .select("business_name, business_type, city, state_province, service_areas, nap_address, nap_phone, primary_category")
      .eq("id", projectId)
      .single(),
    pillarPageId
      ? supabase.from("pillar_pages").select("url, title").eq("id", pillarPageId).single()
      : Promise.resolve({ data: null }),
  ]);

  let pillar: { url: string; title: string } | null = null;
  if (pillarRes.data) pillar = pillarRes.data as { url: string; title: string };

  const p = projectRes.data;
  const localContext = p?.city
    ? {
        businessName: p.business_name,
        businessType: p.business_type,
        city: p.city,
        stateProvince: p.state_province,
        serviceAreas: p.service_areas ?? [],
        napAddress: p.nap_address,
        napPhone: p.nap_phone,
        primaryCategory: p.primary_category,
      }
    : null;

  const prompt = buildArticlePrompt({
    keyword,
    brief: brief ?? "",
    tone: tone ?? "professional",
    targetWordCount: targetWordCount ?? 1500,
    pillar,
    localContext,
  });

  let currentArticleId = articleId;

  if (!currentArticleId) {
    const { data } = await supabase
      .from("articles")
      .insert({
        project_id: projectId,
        status: "draft",
        tone: tone ?? "professional",
        target_word_count: targetWordCount ?? 1500,
        pillar_page_id: pillarPageId ?? null,
        generation_model: "claude-sonnet-4-6",
        generation_prompt: prompt,
      })
      .select()
      .single();
    currentArticleId = data?.id;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let fullText = "";

        for await (const chunk of streamArticle(prompt, targetWordCount ?? 1500)) {
          fullText += chunk;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "chunk", content: chunk, articleId: currentArticleId })}\n\n`
            )
          );
        }

        // Parse structured output from Gemini response
        const metaMatch = fullText.match(/<meta>([\s\S]*?)<\/meta>/);
        const articleMatch = fullText.match(/<article>([\s\S]*?)<\/article>/);
        const outlineMatch = fullText.match(/<outline>([\s\S]*?)<\/outline>/);

        let parsedMeta: { title?: string; slug?: string; meta_description?: string } = {};
        let parsedOutline: Array<{ level: number; text: string }> = [];
        const articleContent = articleMatch?.[1]?.trim() ?? fullText;

        try { if (metaMatch) parsedMeta = JSON.parse(metaMatch[1].trim()); } catch {}
        try { if (outlineMatch) parsedOutline = JSON.parse(outlineMatch[1].trim()); } catch {}

        const wordCount = articleContent.split(/\s+/).filter(Boolean).length;

        if (currentArticleId) {
          await supabase
            .from("articles")
            .update({
              title: parsedMeta.title ?? keyword,
              slug: parsedMeta.slug ?? keyword.toLowerCase().replace(/\s+/g, "-"),
              meta_description: parsedMeta.meta_description ?? null,
              content: articleContent,
              outline: parsedOutline.length ? parsedOutline : null,
              actual_word_count: wordCount,
            })
            .eq("id", currentArticleId);
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "done", articleId: currentArticleId, wordCount })}\n\n`
          )
        );
        controller.close();
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", error: err instanceof Error ? err.message : "Generation failed" })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
