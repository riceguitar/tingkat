import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createProjectSchema } from "@/lib/validations/project";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();
  const parsed = createProjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Verify caller is a member (owner) of the target account
  const { data: membership } = await supabase
    .from("account_members")
    .select("role")
    .eq("account_id", parsed.data.account_id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Account not found or access denied" }, { status: 403 });
  }

  if (membership.role !== "owner") {
    return NextResponse.json({ error: "Only account owners can create projects" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("projects")
    .insert(parsed.data)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
