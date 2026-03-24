"use client";

import { useRouter } from "next/navigation";
import { getTotalSales, formatCurrency } from "@/lib/utils";
import type { DailyRecord } from "@/types";

type Props = {
  year: number;
  month: number;
  records: DailyRecord[];
};

export default function CalendarView({ year, month, records }: Props) {
  const router = useRouter();

  const recordMap = new Map(
    records.map((r) => [new Date(r.date).getDate(), r])
  );

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1);
    router.push(`/calendar?year=${d.getFullYear()}&month=${d.getMonth() + 1}`);
  };

  const nextMonth = () => {
    const d = new Date(year, month, 1);
    router.push(`/calendar?year=${d.getFullYear()}&month=${d.getMonth() + 1}`);
  };

  const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-md text-gray-600">
          ←
        </button>
        <h2 className="text-lg font-semibold text-gray-900">
          {year}년 {month}월
        </h2>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-md text-gray-600">
          →
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {dayLabels.map((d, i) => (
          <div
            key={d}
            className={`py-2 text-center text-xs font-medium ${
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          const record = day ? recordMap.get(day) : null;
          const isToday =
            day !== null &&
            new Date().getFullYear() === year &&
            new Date().getMonth() + 1 === month &&
            new Date().getDate() === day;

          return (
            <div
              key={idx}
              onClick={() => record && router.push(`/sales/${record.id}`)}
              className={`min-h-[80px] p-2 border-b border-r border-gray-100 ${
                day === null
                  ? "bg-gray-50"
                  : record
                  ? "hover:bg-amber-50 cursor-pointer"
                  : "hover:bg-gray-50"
              }`}
            >
              {day !== null && (
                <>
                  <div
                    className={`text-sm font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday
                        ? "bg-amber-500 text-white"
                        : idx % 7 === 0
                        ? "text-red-500"
                        : idx % 7 === 6
                        ? "text-blue-500"
                        : "text-gray-700"
                    }`}
                  >
                    {day}
                  </div>
                  {record && (
                    <div className="mt-1">
                      <div className="text-xs font-medium text-amber-600">
                        {formatCurrency(getTotalSales(record))}
                      </div>
                      <div className="text-xs text-gray-400">
                        🥯 {record.bagelsBaked - record.bagelsLeft}개
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
