import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ accountId: string; userId: string }> }
) {
  const { accountId, userId } = await params;
  const supabase = await createClient();

  const { error } = await supabase
    .from("account_members")
    .delete()
    .eq("account_id", accountId)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
