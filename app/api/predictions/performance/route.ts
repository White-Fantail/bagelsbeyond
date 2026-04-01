import { NextResponse } from "next/server";
import { getPredictionPerformanceStats } from "@/lib/services/predictionService";
import { apiRequireStaffOrAdmin, isNextResponse } from "@/lib/auth/dal";

export async function GET() {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const stats = await getPredictionPerformanceStats();
    return NextResponse.json(stats);
  } catch (_error) {
    return NextResponse.json({ message: "Performance Failed to load data" }, { status: 500 });
  }
}
