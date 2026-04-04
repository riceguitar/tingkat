import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { testWordPressConnection } from "@/lib/api/wordpress";
import { encrypt } from "@/lib/encryption";

export async function POST(req: NextRequest) {
  const { projectId, siteUrl, username, applicationPassword } = await req.json();

  if (!projectId || !siteUrl || !username || !applicationPassword) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const testResult = await testWordPressConnection({ siteUrl, username, password: applicationPassword });
  if (!testResult.success) {
    return NextResponse.json({ success: false, error: testResult.error }, { status: 400 });
  }

  const enc = encrypt(applicationPassword);
  const supabase = await createClient();

  const { error } = await supabase.from("cms_connections").upsert({
    project_id: projectId,
    type: "wordpress",
    site_url: siteUrl.replace(/\/$/, ""),
    username,
    encrypted_password: enc.ciphertext,
    iv: enc.iv,
    auth_tag: enc.authTag,
    verified_at: new Date().toISOString(),
  }, { onConflict: "project_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    siteTitle: testResult.siteTitle,
    wpUserLogin: testResult.wpUserLogin,
  });
}
