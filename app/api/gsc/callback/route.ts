import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, listGscProperties } from "@/lib/api/google-search-console";
import { encrypt } from "@/lib/encryption";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // projectId

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/settings/gsc?error=missing_params`);
  }

  try {
    const tokenData = await exchangeCodeForTokens(code);

    // Get first GSC property
    const properties = await listGscProperties(tokenData.access_token);
    const gscPropertyUrl = properties[0] ?? null;

    const combined = JSON.stringify({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
    });
    const enc = encrypt(combined);

    const supabase = await createClient();
    await supabase.from("gsc_tokens").upsert({
      project_id: state,
      access_token: enc.ciphertext,
      refresh_token: enc.ciphertext,
      token_iv: enc.iv,
      token_auth_tag: enc.authTag,
      expires_at: tokenData.expires_at.toISOString(),
      gsc_property_url: gscPropertyUrl,
    }, { onConflict: "project_id" });

    return NextResponse.redirect(`${origin}/settings/gsc?connected=true`);
  } catch {
    return NextResponse.redirect(`${origin}/settings/gsc?error=token_exchange_failed`);
  }
}
