import { NextRequest, NextResponse } from "next/server";
import { apiRequireStaffOrAdmin, isNextResponse } from "@/lib/auth/dal";
import { getAuditLogs } from "@/lib/services/bagel-availability-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await apiRequireStaffOrAdmin();
  if (isNextResponse(auth)) return auth;

  const { searchParams } = new URL(req.url);
  const bagelTypeId = searchParams.get("bagelTypeId") ?? undefined;
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  try {
    const logs = await getAuditLogs({ bagelTypeId, limit });
    return NextResponse.json(logs);
  } catch (err) {
    console.error("[GET /api/admin/bagel-availability/audit-logs]", err);
    return NextResponse.json({ message: "Failed to load audit logs" }, { status: 500 });
  }
}
