import { NextRequest, NextResponse } from "next/server";
import { clusterKeywords } from "@/lib/api/gemini";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { keywords, maxClusters = 8 } = body;

  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return NextResponse.json({ error: "keywords array is required" }, { status: 400 });
  }

  try {
    const clusters = await clusterKeywords(keywords, maxClusters);
    return NextResponse.json({ clusters });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Clustering failed" },
      { status: 500 }
    );
  }
}
