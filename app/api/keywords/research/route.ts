import { NextRequest, NextResponse } from "next/server";
import { getKeywordIdeas } from "@/lib/api/dataforseo";
import { keywordResearchSchema } from "@/lib/validations/keyword";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = keywordResearchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const keywords = await getKeywordIdeas(
      parsed.data.seedKeyword,
      parsed.data.locationCode,
      parsed.data.languageCode,
      parsed.data.limit
    );
    return NextResponse.json({ keywords });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Research failed" },
      { status: 500 }
    );
  }
}
