export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import CalendarView from "@/components/CalendarView";
import type { SalesPrediction } from "@/types";

async function getCalendarData(year: number, month: number) {
  try {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const [records, predictions] = await Promise.all([
      prisma.dailyRecord.findMany({
        where: { date: { gte: start, lte: end } },
        orderBy: { date: "asc" },
      }),
      prisma.salesPrediction.findMany({
        where: { targetDate: { gte: start, lte: end } },
        orderBy: { targetDate: "asc" },
      }),
    ]);

    return { records, predictions: predictions as SalesPrediction[] };
  } catch {
    return { records: [], predictions: [] };
  }
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = parseInt(params.year ?? String(now.getFullYear()));
  const month = parseInt(params.month ?? String(now.getMonth() + 1));
  const { records, predictions } = await getCalendarData(year, month);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">달력 보기</h1>
        <p className="text-gray-500 mt-1">월별 매출 실적 및 예측 현황</p>
      </div>
      <CalendarView year={year} month={month} records={records} predictions={predictions} />
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-400 inline-block"></span>
          실제 매출 기록
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-400 inline-block"></span>
          예측만 있음
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-purple-400 inline-block"></span>
          실적 + 예측 모두 있음
        </div>
      </div>
    </div>
  );
}
