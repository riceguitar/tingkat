import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/api/google-search-console";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId") ?? "default";
  const authUrl = getAuthUrl(projectId);
  return NextResponse.json({ authUrl });
}
