import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getKeywordIdeas } from "@/lib/api/dataforseo";
import { getCredentialsByProject } from "@/lib/api/credentials";
import { keywordResearchSchema } from "@/lib/validations/keyword";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = keywordResearchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let locationCode = parsed.data.locationCode;
  let dfsCreds = { login: process.env.DATAFORSEO_LOGIN ?? "", apiKey: process.env.DATAFORSEO_API_KEY ?? "" };

  if (parsed.data.projectId) {
    try {
      const supabase = await createClient();
      const [projectRes, accountCreds] = await Promise.all([
        supabase.from("projects").select("location_code").eq("id", parsed.data.projectId).single(),
        getCredentialsByProject(supabase, parsed.data.projectId),
      ]);
      if (projectRes.data?.location_code && locationCode === 2840) locationCode = projectRes.data.location_code;
      dfsCreds = { login: accountCreds.dataforseoLogin, apiKey: accountCreds.dataforseoApiKey };
    } catch { /* fall back to defaults */ }
  }

  try {
    const keywords = await getKeywordIdeas(
      parsed.data.seedKeyword,
      locationCode,
      parsed.data.languageCode,
      parsed.data.limit,
      dfsCreds
    );
    return NextResponse.json({ keywords, locationCode });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Research failed" },
      { status: 500 }
    );
  }
}
