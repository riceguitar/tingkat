import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const supabase = await createClient();

  const [{ data: tokenRow }, { data: lastSync }, { count: rowCount }] = await Promise.all([
    supabase
      .from("gsc_tokens")
      .select("gsc_property_url, expires_at")
      .eq("project_id", projectId)
      .single(),
    supabase
      .from("gsc_snapshots")
      .select("snapshot_date")
      .eq("project_id", projectId)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("gsc_snapshots")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId),
  ]);

  if (!tokenRow) {
    return NextResponse.json({ connected: false, propertyUrl: null, lastSyncDate: null, rowCount: 0 });
  }

  return NextResponse.json({
    connected: true,
    propertyUrl: tokenRow.gsc_property_url ?? null,
    propertyChosen: !!tokenRow.gsc_property_url,
    lastSyncDate: lastSync?.snapshot_date ?? null,
    rowCount: rowCount ?? 0,
    tokenExpired: new Date(tokenRow.expires_at) < new Date(),
  });
}
