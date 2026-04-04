import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startOfMonth, endOfMonth } from "date-fns";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("projectId");
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

  const start = startOfMonth(new Date(year, month - 1)).toISOString();
  const end = endOfMonth(new Date(year, month - 1)).toISOString();

  const supabase = await createClient();
  let query = supabase
    .from("articles")
    .select("id, title, status, scheduled_at, published_at, projects(name)")
    .or(`scheduled_at.gte.${start},published_at.gte.${start}`)
    .or(`scheduled_at.lte.${end},published_at.lte.${end}`)
    .neq("status", "draft");

  if (projectId) query = query.eq("project_id", projectId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { articleId, scheduledAt } = await req.json();

  if (!articleId || !scheduledAt) {
    return NextResponse.json({ error: "articleId and scheduledAt are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("articles")
    .update({ scheduled_at: scheduledAt, status: "scheduled" })
    .eq("id", articleId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
