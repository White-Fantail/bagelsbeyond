"use client";

import { useRouter } from "next/navigation";
import { getTotalSales, formatCurrency } from "@/lib/utils";
import { getWeatherIcon } from "@/lib/utils/weather-icon";
import type { DailyRecord, DailyExternalFactor, SalesPrediction } from "@/types";

type Props = {
  year: number;
  month: number;
  records: DailyRecord[];
  predictions?: SalesPrediction[];
  /** Map of day-of-month → DailyExternalFactor for weather icon display */
  externalFactors?: Map<number, DailyExternalFactor>;
};

export default function CalendarView({ year, month, records, predictions = [], externalFactors }: Props) {
  const router = useRouter();

  const recordMap = new Map(
    records.map((r) => [new Date(r.date).getDate(), r])
  );

  const predictionMap = new Map(
    predictions.map((p) => [new Date(p.targetDate).getDate(), p])
  );

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

  const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const handleDayClick = (day: number, record: DailyRecord | undefined, prediction: SalesPrediction | undefined) => {
    if (record) {
      router.push(`/sales/${record.id}`);
    } else if (prediction) {
      router.push(`/predictions/${prediction.id}`);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-md text-gray-600">←</button>
        <h2 className="text-lg font-semibold text-gray-900">{year}년 {month}월</h2>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-md text-gray-600">→</button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {dayLabels.map((d, i) => (
          <div
            key={d}
            className={`py-2 text-center text-xs font-medium ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"}`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          const record = day ? recordMap.get(day) : undefined;
          const prediction = day ? predictionMap.get(day) : undefined;
          const hasBoth = !!(record && prediction);
          const hasRecord = !!record;
          const hasPrediction = !!(prediction && !record);

          const isToday =
            day !== null &&
            today.getFullYear() === year &&
            today.getMonth() + 1 === month &&
            today.getDate() === day;

          const isFuture =
            day !== null &&
            new Date(year, month - 1, day) > today;

          const isClickable = !!(record || prediction);

          // Weather icon for this day
          const ef = day ? externalFactors?.get(day) : undefined;
          const weatherInfo = ef ? getWeatherIcon(ef.weatherSummary) : null;

          let bgClass = "";
          if (hasBoth) bgClass = "hover:bg-purple-50";
          else if (hasRecord) bgClass = "hover:bg-amber-50";
          else if (hasPrediction) bgClass = "hover:bg-blue-50";
          else bgClass = "hover:bg-gray-50";

          return (
            <div
              key={idx}
              onClick={() => day && isClickable && handleDayClick(day, record, prediction)}
              role={isClickable ? "button" : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onKeyDown={
                isClickable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        if (day) handleDayClick(day, record, prediction);
                      }
                    }
                  : undefined
              }
              aria-label={
                day
                  ? `${year}년 ${month}월 ${day}일${record ? " 실적 있음" : ""}${prediction ? " 예측 있음" : ""}`
                  : undefined
              }
              className={`min-h-[90px] p-1.5 border-b border-r border-gray-100 transition-colors relative ${
                day === null ? "bg-gray-50" : isClickable ? `cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 ${bgClass}` : bgClass
              } ${isFuture ? "bg-slate-50" : ""}`}
            >
              {day !== null && (
                <>
                  {/* Weather icon — top-right corner */}
                  {weatherInfo && (
                    <span
                      className="absolute top-1 right-1 text-[11px] leading-none select-none"
                      title={ef?.weatherSummary ?? weatherInfo.label}
                      aria-label={weatherInfo.label}
                    >
                      {weatherInfo.icon}
                    </span>
                  )}

                  {/* Day number */}
                  <div
                    className={`text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full ${
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

                  {/* Status dot */}
                  {(hasBoth || hasRecord || hasPrediction) && (
                    <div className="flex gap-0.5 mb-1">
                      {hasRecord && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                      {hasPrediction && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                      {hasBoth && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                    </div>
                  )}

                  {/* Actual record data */}
                  {record && (
                    <div>
                      <div className="text-[10px] font-semibold text-amber-700 leading-tight">
                        {formatCurrency(getTotalSales(record))}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        🥯{record.bagelsBaked - record.bagelsLeft}
                      </div>
                    </div>
                  )}

                  {/* Prediction data (future or when no actual) */}
                  {prediction && !record && (
                    <div>
                      <div className="text-[10px] font-semibold text-blue-600 leading-tight">
                        ~{formatCurrency(prediction.predictedSales)}
                      </div>
                      <div className="text-[10px] text-blue-400">
                        🔮{prediction.recommendedBagelsToBake}굽
                      </div>
                    </div>
                  )}

                  {/* Both: show actual with prediction sub-text */}
                  {hasBoth && (
                    <div className="text-[10px] text-purple-500 mt-0.5">
                      예측 있음
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
