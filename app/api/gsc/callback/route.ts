import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/api/google-search-console";
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
      // Leave gsc_property_url null — user picks it on the next screen
      gsc_property_url: null,
    }, { onConflict: "project_id" });

    // Redirect to property picker rather than silently picking properties[0]
    return NextResponse.redirect(
      `${origin}/settings/gsc?projectId=${state}&choosingProperty=true`
    );
  } catch {
    return NextResponse.redirect(`${origin}/settings/gsc?error=token_exchange_failed`);
  }
}
