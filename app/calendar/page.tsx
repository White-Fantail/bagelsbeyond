export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import CalendarView from "@/components/CalendarView";
import type { DailyExternalFactor, SalesPrediction } from "@/types";

async function getCalendarData(year: number, month: number) {
  try {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const [records, predictions, externalFactorRows] = await Promise.all([
      prisma.dailyRecord.findMany({
        where: { date: { gte: start, lte: end } },
        orderBy: { date: "asc" },
      }),
      prisma.salesPrediction.findMany({
        where: { targetDate: { gte: start, lte: end } },
        orderBy: { targetDate: "asc" },
      }),
      prisma.dailyExternalFactor.findMany({
        where: { date: { gte: start, lte: end } },
        orderBy: { date: "asc" },
      }),
    ]);

    // Build a Map of day-of-month → DailyExternalFactor for quick lookup
    const externalFactorMap = new Map<number, DailyExternalFactor>(
      externalFactorRows.map((ef) => [new Date(ef.date).getDate(), ef as DailyExternalFactor])
    );

    return {
      records,
      predictions: predictions as SalesPrediction[],
      externalFactorMap,
    };
  } catch {
    return { records: [], predictions: [], externalFactorMap: new Map<number, DailyExternalFactor>() };
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
  const { records, predictions, externalFactorMap } = await getCalendarData(year, month);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calendar View</h1>
        <p className="text-gray-500 mt-1">Monthly sales performance and prediction status</p>
      </div>
      <CalendarView year={year} month={month} records={records} predictions={predictions} externalFactors={externalFactorMap} />
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-400 inline-block"></span>
          Actual Sales Records
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-400 inline-block"></span>
          Prediction only
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-purple-400 inline-block"></span>
          Has both actual and predicted
        </div>
      </div>
    </div>
  );
}
