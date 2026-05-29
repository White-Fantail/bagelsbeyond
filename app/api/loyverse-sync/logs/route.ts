import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { listLoyverseSyncLogs } from "@/lib/services/loyverseProductSyncService";

export async function GET(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 20;

  try {
    const logs = await listLoyverseSyncLogs(Number.isFinite(limit) ? limit : 20);
    return NextResponse.json({ logs });
  } catch {
    return NextResponse.json({ message: "Failed to fetch sync logs" }, { status: 500 });
  }
}
