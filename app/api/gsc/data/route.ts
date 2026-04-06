import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSearchAnalytics, refreshAccessToken } from "@/lib/api/google-search-console";
import { decrypt, encrypt } from "@/lib/encryption";
import { subDays, format } from "date-fns";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("projectId");
  const from = searchParams.get("from") ?? format(subDays(new Date(), 28), "yyyy-MM-dd");
  const to = searchParams.get("to") ?? format(new Date(), "yyyy-MM-dd");

  if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });

  const supabase = await createClient();
  const { data: tokenRow } = await supabase
    .from("gsc_tokens")
    .select("*")
    .eq("project_id", projectId)
    .single();

  if (!tokenRow) return NextResponse.json({ error: "GSC not connected" }, { status: 400 });

  let accessToken: string;
  const tokens = JSON.parse(decrypt(tokenRow.access_token, tokenRow.token_iv, tokenRow.token_auth_tag));

  if (new Date(tokenRow.expires_at) < new Date()) {
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    accessToken = refreshed.access_token;

    const newCombined = JSON.stringify({ access_token: accessToken, refresh_token: tokens.refresh_token });
    const enc = encrypt(newCombined);
    await supabase.from("gsc_tokens").update({
      access_token: enc.ciphertext,
      token_iv: enc.iv,
      token_auth_tag: enc.authTag,
      expires_at: refreshed.expires_at.toISOString(),
    }).eq("project_id", projectId);
  } else {
    accessToken = tokens.access_token;
  }

  const siteUrl = tokenRow.gsc_property_url;
  if (!siteUrl) return NextResponse.json({ error: "No GSC property set" }, { status: 400 });

  const rows = await getSearchAnalytics(accessToken, siteUrl, from, to);

  const snapshots = rows.map((row) => ({
    project_id: projectId,
    query: row.query,
    page: row.page,
    snapshot_date: row.date,
    impressions: row.impressions,
    clicks: row.clicks,
    ctr: row.ctr,
    position: row.position,
  }));

  if (snapshots.length) {
    await supabase.from("gsc_snapshots").upsert(snapshots, {
      onConflict: "project_id,query,page,snapshot_date",
    });

    // Link matched keywords — idempotent, safe to run every sync
    await supabase.rpc("link_gsc_keyword_ids", { p_project_id: projectId });
  }

  return NextResponse.json({ rows, synced: snapshots.length });
}
