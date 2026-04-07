import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/encryption";

const KNOWN_KEYS = ["dataforseo_login", "dataforseo_api_key", "anthropic_api_key"] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("account_credentials")
    .select("key")
    .eq("account_id", accountId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const setKeys = new Set((data ?? []).map((r) => r.key));
  const result = KNOWN_KEYS.map((key) => ({ key, isSet: setKeys.has(key) }));

  return NextResponse.json(result);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;
  const supabase = await createClient();

  const body = await req.json();
  const { key, value } = body as { key?: string; value?: string };

  if (!key || !value) {
    return NextResponse.json({ error: "key and value are required" }, { status: 400 });
  }

  if (!KNOWN_KEYS.includes(key as typeof KNOWN_KEYS[number])) {
    return NextResponse.json({ error: "Unknown credential key" }, { status: 400 });
  }

  const { iv, authTag, ciphertext } = encrypt(value);

  const { error } = await supabase
    .from("account_credentials")
    .upsert(
      { account_id: accountId, key, encrypted_value: ciphertext, iv, auth_tag: authTag },
      { onConflict: "account_id,key" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
