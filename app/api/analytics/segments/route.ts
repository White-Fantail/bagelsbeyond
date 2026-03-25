import { NextRequest, NextResponse } from "next/server";
import {
  getHolidaySegmentComparison,
  getSchoolHolidaySegmentComparison,
  getRainSegmentComparison,
  getEventSegmentComparison,
} from "@/lib/services/analytics";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

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

    const [holiday, schoolHoliday, rain, event] = await Promise.all([
      getHolidaySegmentComparison(startDate, endDate),
      getSchoolHolidaySegmentComparison(startDate, endDate),
      getRainSegmentComparison(startDate, endDate),
      getEventSegmentComparison(startDate, endDate),
    ]);

    return NextResponse.json({ holiday, schoolHoliday, rain, event });
  } catch (_error) {
    console.error(_error);
    return NextResponse.json(
      { message: "세그먼트 분석 데이터를 불러오는데 실패했습니다" },
      { status: 500 }
    );
  }
}
