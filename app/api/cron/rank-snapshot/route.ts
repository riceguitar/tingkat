import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSerpPositions } from "@/lib/api/dataforseo";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: projects } = await supabase.from("projects").select("id, domain");
  if (!projects?.length) return NextResponse.json({ processed: 0 });

  let totalSnapshots = 0;
  for (const project of projects) {
    const { data: keywords } = await supabase
      .from("keywords")
      .select("id, keyword")
      .eq("project_id", project.id);

    if (!keywords?.length) continue;

    const results = await getSerpPositions(project.domain, keywords.map((k) => k.keyword));
    const today = new Date().toISOString().split("T")[0];

    const snapshots = results.map((r) => {
      const kw = keywords.find((k) => k.keyword === r.keyword);
      return { keyword_id: kw!.id, project_id: project.id, position: r.position, url: r.url, device: "desktop", location: "US", snapshot_date: today };
    });

    await supabase.from("rank_snapshots").upsert(snapshots, { onConflict: "keyword_id,device,location,snapshot_date" });
    totalSnapshots += snapshots.length;
  }

  return NextResponse.json({ processed: totalSnapshots });
}
