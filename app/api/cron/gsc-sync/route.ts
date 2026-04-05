import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSearchAnalytics, refreshAccessToken } from "@/lib/api/google-search-console";
import { decrypt, encrypt } from "@/lib/encryption";
import { format, subDays } from "date-fns";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: tokenRows } = await supabase.from("gsc_tokens").select("*");
  if (!tokenRows?.length) return NextResponse.json({ processed: 0 });

  const from = format(subDays(new Date(), 3), "yyyy-MM-dd");
  const to = format(new Date(), "yyyy-MM-dd");
  let totalSynced = 0;

  for (const tokenRow of tokenRows) {
    try {
      const tokens = JSON.parse(decrypt(tokenRow.access_token, tokenRow.token_iv, tokenRow.token_auth_tag));
      let accessToken = tokens.access_token;

      if (new Date(tokenRow.expires_at) < new Date()) {
        const refreshed = await refreshAccessToken(tokens.refresh_token);
        accessToken = refreshed.access_token;
        const enc = encrypt(JSON.stringify({ access_token: accessToken, refresh_token: tokens.refresh_token }));
        await supabase.from("gsc_tokens").update({ access_token: enc.ciphertext, token_iv: enc.iv, token_auth_tag: enc.authTag, expires_at: refreshed.expires_at.toISOString() }).eq("id", tokenRow.id);
      }

      if (!tokenRow.gsc_property_url) continue;
      const rows = await getSearchAnalytics(accessToken, tokenRow.gsc_property_url, from, to);
      const snapshots = rows.map((r) => ({ project_id: tokenRow.project_id, query: r.query, page: r.page, snapshot_date: r.date, impressions: r.impressions, clicks: r.clicks, ctr: r.ctr, position: r.position }));
      if (snapshots.length) {
        await supabase.from("gsc_snapshots").upsert(snapshots, { onConflict: "project_id,query,page,snapshot_date" });
        totalSynced += snapshots.length;
        // Link matched keywords — idempotent
        await supabase.rpc("link_gsc_keyword_ids", { p_project_id: tokenRow.project_id });
      }
    } catch {}
  }

  return NextResponse.json({ processed: totalSynced });
}
