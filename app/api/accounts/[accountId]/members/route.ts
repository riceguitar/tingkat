import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("account_members")
    .select("id, user_id, role, created_at")
    .eq("account_id", accountId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const supabase = await createClient();

  const body = await req.json();
  const { email } = body as { email?: string };

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  // Verify caller is owner
  const { data: membership } = await supabase
    .from("account_members")
    .select("role")
    .eq("account_id", accountId)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Account not found or access denied" }, { status: 403 });
  }
  if (membership.role !== "owner") {
    return NextResponse.json({ error: "Only owners can add members" }, { status: 403 });
  }

  // Find user by email via security-definer RPC
  const { data: userId } = await supabase.rpc("find_user_id_by_email", { p_email: email });

  if (!userId) {
    return NextResponse.json({ error: "No account found for that email. The user must sign up first." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("account_members")
    .insert({ account_id: accountId, user_id: userId, role: "member" })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "User is already a member of this account" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
