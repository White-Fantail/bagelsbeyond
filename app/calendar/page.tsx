export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import CalendarView from "@/components/CalendarView";

async function getCalendarData(year: number, month: number) {
  try {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);
    return await prisma.dailyRecord.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    });
  } catch {
    return [];
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
  const records = await getCalendarData(year, month);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">달력 보기</h1>
        <p className="text-gray-500 mt-1">월별 매출 현황</p>
      </div>
      <CalendarView year={year} month={month} records={records} />
    </div>
  );
}
