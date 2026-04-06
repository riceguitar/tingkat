import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getKeywordIdeas } from "@/lib/api/dataforseo";
import { keywordResearchSchema } from "@/lib/validations/keyword";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = keywordResearchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Use the project's location_code if no explicit override was sent
  let locationCode = parsed.data.locationCode;
  if (locationCode === 2840 && parsed.data.projectId) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("projects")
        .select("location_code")
        .eq("id", parsed.data.projectId)
        .single();
      if (data?.location_code) locationCode = data.location_code;
    } catch { /* fall back to default */ }
  }

  try {
    const keywords = await getKeywordIdeas(
      parsed.data.seedKeyword,
      locationCode,
      parsed.data.languageCode,
      parsed.data.limit
    );
    return NextResponse.json({ keywords, locationCode });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Research failed" },
      { status: 500 }
    );
  }
}
