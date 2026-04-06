import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSerpPositions } from "@/lib/api/dataforseo";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { projectId, keywordIds, device = "desktop", locationCode = 2840 } = await req.json();

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("domain, location_code, city, state_province, country_code")
    .eq("id", projectId)
    .single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Use project's location_code unless caller passed an explicit non-default override
  const effectiveLocationCode = locationCode !== 2840 ? locationCode : (project.location_code ?? 2840);
  const locationLabel = project.city && project.state_province
    ? `${project.city}, ${project.state_province}`
    : project.country_code ?? "US";

  let kwQuery = supabase.from("keywords").select("id, keyword").eq("project_id", projectId);
  if (keywordIds?.length) kwQuery = kwQuery.in("id", keywordIds);

  const { data: keywords } = await kwQuery;
  if (!keywords?.length) return NextResponse.json({ snapshotsCreated: 0 });

  const keywordTexts = keywords.map((k) => k.keyword);
  const serpResults = await getSerpPositions(project.domain, keywordTexts, effectiveLocationCode, "en", device);

  const today = new Date().toISOString().split("T")[0];
  const snapshots = serpResults.map((result) => {
    const kw = keywords.find((k) => k.keyword === result.keyword);
    return {
      keyword_id: kw!.id,
      project_id: projectId,
      position: result.position,
      url: result.url,
      device,
      location: locationLabel,
      snapshot_date: today,
    };
  });

  const { error } = await supabase
    .from("rank_snapshots")
    .upsert(snapshots, { onConflict: "keyword_id,device,location,snapshot_date" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Upsert local pack snapshots (silently ignore errors — table may not exist yet in some envs)
  const localPackSnapshots = serpResults.map((result) => {
    const kw = keywords.find((k) => k.keyword === result.keyword);
    return {
      project_id: projectId,
      keyword_id: kw!.id,
      keyword: result.keyword,
      position: result.local_pack_position,
      pack_present: result.local_pack_present,
      snapshot_date: today,
      location: locationLabel,
    };
  });

  await supabase
    .from("local_pack_snapshots")
    .upsert(localPackSnapshots, { onConflict: "project_id,keyword,snapshot_date,location" })
    .then(() => {});

  return NextResponse.json({ snapshotsCreated: snapshots.length });
}
