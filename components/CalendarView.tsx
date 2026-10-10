"use client";

import { Fragment } from "react";
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
  const recordMap = new Map(records.map((r) => [new Date(r.date).toISOString().slice(0, 10), r]));
  const dateKey = (day: number) => {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toISOString().slice(0, 10);
  };
  const today = new Date();
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

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-md text-gray-600">←</button>
        <h2 className="text-lg font-semibold text-gray-900">{year}/{month}</h2>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-md text-gray-600">→</button>
      </div>

      <div className="overflow-x-auto">
      <div className="min-w-[760px]">
      <div className="grid grid-cols-9 border-b border-gray-200">
        {dayLabels.map((d, i) => (
          <div key={d} className={`py-2 text-center text-xs font-medium ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"}`}>
            {d}
          </div>
        ))}
        <div className="py-2 text-center text-xs font-medium text-gray-600 bg-amber-50">Weekly Total</div>
        <div className="py-2 text-center text-xs font-medium text-gray-600 bg-amber-50">Daily Average</div>
      </div>

      <div className="grid grid-cols-9">
        {weeks.map((week, weekIndex) => {
          const weekRecords = week.flatMap((_, dayIndex) => {
            const day = weekIndex * 7 + dayIndex - firstDay + 1;
            const record = recordMap.get(dateKey(day));
            return record ? [record] : [];
          });
          const total = weekRecords.reduce((sum, record) => sum + getTotalSales(record), 0);
          return (
            <Fragment key={weekIndex}>
        {week.map((day, dayIndex) => {
          const idx = weekIndex * 7 + dayIndex;
          const record = day ? recordMap.get(dateKey(day)) : undefined;
          const isToday = day !== null && today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day;
          const isFuture = day !== null && new Date(year, month - 1, day) > today;

          return (
            <div
              key={idx}
              onClick={() => record && router.push(`/sales/${record.id}`)}
              role={record ? "button" : undefined}
              tabIndex={record ? 0 : undefined}
              onKeyDown={record ? (e) => {
                if (e.key === "Enter" || e.key === " ") router.push(`/sales/${record.id}`);
              } : undefined}
              aria-label={day ? `${year}/${month}/${day}${record ? " has sales data" : ""}` : undefined}
              className={`min-h-[90px] p-1.5 border-b border-r border-gray-100 transition-colors ${day === null ? "bg-gray-50" : record ? "cursor-pointer hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-400" : "hover:bg-gray-50"} ${isFuture ? "bg-slate-50" : ""}`}
            >
              {day !== null && (
                <>
                  <div className={`text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full ${isToday ? "bg-amber-500 text-white" : idx % 7 === 0 ? "text-red-500" : idx % 7 === 6 ? "text-blue-500" : "text-gray-700"}`}>
                    {day}
                  </div>
                  {record && (
                    <div>
                      <div className="text-[10px] font-semibold text-amber-700 leading-tight">
                        {formatCurrency(getTotalSales(record))}
                      </div>
                      <div className="text-[10px] text-gray-400">🥯{record.bagelsBaked - record.bagelsLeft}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
              <div className="min-h-[90px] p-2 border-b border-r border-gray-100 bg-amber-50 flex items-center justify-center text-xs font-semibold text-amber-800">
                {weekRecords.length ? formatCurrency(total) : "—"}
              </div>
              <div className="min-h-[90px] p-2 border-b border-gray-100 bg-amber-50 flex flex-col items-center justify-center gap-1">
                <span className="text-xs font-semibold text-amber-800">
                  {weekRecords.length ? formatCurrency(total / weekRecords.length) : "—"}
                </span>
                {weekRecords.length > 0 && <span className="text-[10px] text-gray-500">{weekRecords.length} recorded days</span>}
              </div>
            </Fragment>
          );
        })}
      </div>
      </div>
      </div>
      <p className="px-4 py-3 text-xs text-gray-500 border-t border-gray-200">Weekly figures cover Sunday–Saturday, including dates in adjacent months. Daily averages use recorded days, including days with zero sales.</p>
    </div>
  );
}
