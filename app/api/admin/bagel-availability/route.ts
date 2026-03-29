// GET /api/admin/bagel-availability — list all bagel types with current state + channel sync status

import { NextResponse } from "next/server";
import { apiRequireStaffOrAdmin, isNextResponse } from "@/lib/auth/dal";
import { listBagelTypesWithState } from "@/lib/services/bagel-availability-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await apiRequireStaffOrAdmin();
  if (isNextResponse(auth)) return auth;

  try {
    const data = await listBagelTypesWithState();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[GET /api/admin/bagel-availability]", err);
    return NextResponse.json({ message: "Failed to load bagel types" }, { status: 500 });
  }
}
