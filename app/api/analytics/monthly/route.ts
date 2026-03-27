import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { getMonthlyAnalytics } from "@/lib/services/analytics";

export async function GET(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const { searchParams } = new URL(req.url);

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    // Default: all time - use epoch start
    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : new Date(0);
    startDate.setHours(0, 0, 0, 0);

    const overrideEnd = searchParams.get("endDate");
    if (overrideEnd) {
      const d = new Date(overrideEnd);
      d.setHours(23, 59, 59, 999);
      endDate.setTime(d.getTime());
    }

    const data = await getMonthlyAnalytics(startDate, endDate);
    return NextResponse.json(data);
  } catch (_error) {
    console.error(_error);
    return NextResponse.json(
      { message: "monthly Analytics Failed to load data" },
      { status: 500 }
    );
  }
}
