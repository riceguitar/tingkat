import { NextRequest, NextResponse } from "next/server";
import { clusterKeywords } from "@/lib/api/gemini";
import { createClient } from "@/lib/supabase/server";
import { getCredentialsByProject } from "@/lib/api/credentials";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { keywords, maxClusters = 8, projectId } = body;

  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return NextResponse.json({ error: "keywords array is required" }, { status: 400 });
  }

  let anthropicCreds = { apiKey: process.env.ANTHROPIC_API_KEY ?? "" };
  if (projectId) {
    try {
      const supabase = await createClient();
      const creds = await getCredentialsByProject(supabase, projectId);
      anthropicCreds = { apiKey: creds.anthropicApiKey };
    } catch { /* fall back to env var */ }
  }

  try {
    const clusters = await clusterKeywords(keywords, maxClusters, anthropicCreds);
    return NextResponse.json({ clusters });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Clustering failed" },
      { status: 500 }
    );
  }
}
