import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { getSyncLogDetail } from "@/lib/services/supplierSyncService";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { logId } = await params;

  try {
    const log = await getSyncLogDetail(logId);
    if (!log) {
      return NextResponse.json({ message: "Sync log not found" }, { status: 404 });
    }
    return NextResponse.json({ log });
  } catch {
    return NextResponse.json(
      { message: "Failed to fetch sync log" },
      { status: 500 }
    );
  }
}
