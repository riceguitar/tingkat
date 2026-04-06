import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listGscProperties, refreshAccessToken } from "@/lib/api/google-search-console";
import { decrypt, encrypt } from "@/lib/encryption";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

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
    const enc = encrypt(JSON.stringify({ access_token: accessToken, refresh_token: tokens.refresh_token }));
    await supabase.from("gsc_tokens").update({
      access_token: enc.ciphertext, token_iv: enc.iv, token_auth_tag: enc.authTag,
      expires_at: refreshed.expires_at.toISOString(),
    }).eq("project_id", projectId);
  } else {
    accessToken = tokens.access_token;
  }

  try {
    const properties = await listGscProperties(accessToken);
    return NextResponse.json({ properties });
  } catch {
    return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const { propertyUrl } = await req.json();
  if (!propertyUrl) return NextResponse.json({ error: "propertyUrl required" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase
    .from("gsc_tokens")
    .update({ gsc_property_url: propertyUrl })
    .eq("project_id", projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
