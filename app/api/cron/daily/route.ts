import { NextRequest, NextResponse } from "next/server";
import { GET as rankSnapshotGET } from "../rank-snapshot/route";
import { GET as gscSyncGET } from "../gsc-sync/route";

export async function GET(req: NextRequest) {
  // Shared Auth check (redundant but safe)
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Run rank snapshot sync
    const rankSnapshotRes = await rankSnapshotGET(req);
    const rankSnapshotData = await rankSnapshotRes.json();

    // Run GSC sync
    const gscSyncRes = await gscSyncGET(req);
    const gscSyncData = await gscSyncRes.json();

    return NextResponse.json({
      success: true,
      rankSnapshot: rankSnapshotData,
      gscSync: gscSyncData
    });
  } catch (error) {
    console.error("Error in combined daily cron:", error);
    return NextResponse.json({ error: "Daily cron sync failed" }, { status: 500 });
  }
}
