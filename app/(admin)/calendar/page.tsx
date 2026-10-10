export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import CalendarView from "@/components/CalendarView";

async function getCalendarData(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(year, month, 0);
  end.setDate(end.getDate() + 7 - end.getDay());

  return prisma.dailyRecord.findMany({
    where: { date: { gte: start, lt: end } },
    orderBy: { date: "asc" },
  });
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
        <h1 className="text-2xl font-bold text-gray-900">Calendar View</h1>
        <p className="text-gray-500 mt-1">Monthly sales performance</p>
      </div>
      <CalendarView year={year} month={month} records={records} />
    </div>
  );
}
