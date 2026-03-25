import { NextRequest, NextResponse } from "next/server";
import {
  getPeriodSummary,
  getPeriodComparison,
} from "@/lib/services/analytics";
import { buildComparablePreviousPeriod } from "@/lib/analytics-utils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);

    const overrideEnd = searchParams.get("endDate");
    if (overrideEnd) {
      const d = new Date(overrideEnd);
      d.setHours(23, 59, 59, 999);
      endDate.setTime(d.getTime());
    }

    const compareWithPrevious = searchParams.get("compareWithPrevious") === "true";

    const current = await getPeriodSummary(startDate, endDate);

    if (!compareWithPrevious) {
      return NextResponse.json({ current });
    }

    const { previousStart, previousEnd } = buildComparablePreviousPeriod(
      startDate,
      endDate
    );
    const comparison = await getPeriodComparison(
      startDate,
      endDate,
      previousStart,
      previousEnd
    );

    return NextResponse.json({
      current,
      previous: comparison.previous,
      comparison,
    });
  } catch (_error) {
    console.error(_error);
    return NextResponse.json(
      { message: "분석 데이터를 불러오는데 실패했습니다" },
      { status: 500 }
    );
  }
}
