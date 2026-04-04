import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSerpPositions } from "@/lib/api/dataforseo";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { projectId, keywordIds, device = "desktop", locationCode = 2840 } = await req.json();

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const { data: project } = await supabase.from("projects").select("domain").eq("id", projectId).single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  let kwQuery = supabase.from("keywords").select("id, keyword").eq("project_id", projectId);
  if (keywordIds?.length) kwQuery = kwQuery.in("id", keywordIds);

  const { data: keywords } = await kwQuery;
  if (!keywords?.length) return NextResponse.json({ snapshotsCreated: 0 });

  const keywordTexts = keywords.map((k) => k.keyword);
  const serpResults = await getSerpPositions(project.domain, keywordTexts, locationCode, "en", device);

  const today = new Date().toISOString().split("T")[0];
  const snapshots = serpResults.map((result) => {
    const kw = keywords.find((k) => k.keyword === result.keyword);
    return {
      keyword_id: kw!.id,
      project_id: projectId,
      position: result.position,
      url: result.url,
      device,
      location: "US",
      snapshot_date: today,
    };
  });

  const { error } = await supabase
    .from("rank_snapshots")
    .upsert(snapshots, { onConflict: "keyword_id,device,location,snapshot_date" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ snapshotsCreated: snapshots.length });
}
