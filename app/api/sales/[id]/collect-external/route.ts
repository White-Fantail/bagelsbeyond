import { NextRequest, NextResponse } from "next/server";
import { refreshExternalFactorsForRecord } from "@/lib/services/externalFactorService";
import { apiRequireStaffOrAdmin, isNextResponse } from "@/lib/auth/dal";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const { id } = await params;
    const result = await refreshExternalFactorsForRecord(id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "External Data Collection failed";
    return NextResponse.json({ message }, { status: 500 });
  }
}
