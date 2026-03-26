import type { DayOfWeekAnalyticsItem } from "@/lib/services/analytics";
import { formatCurrencyNZD, formatPercentage } from "@/lib/analytics-utils";

type Props = {
  data: DayOfWeekAnalyticsItem[];
};

export default function DayOfWeekTable({ data }: Props) {
  if (data.every((d) => d.recordCount === 0)) {
    return (
      <p className="text-sm text-gray-500 py-4 text-center">
        해당 기간에 데이터가 없습니다.
      </p>
    );
  }

  const maxAvgSales = Math.max(...data.map((d) => d.avgSales), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 pr-3 font-medium text-gray-500 whitespace-nowrap">요일</th>
            <th className="text-right py-2 px-2 font-medium text-gray-500 whitespace-nowrap">일수</th>
            <th className="text-right py-2 px-2 font-medium text-gray-500 whitespace-nowrap">평균 매출</th>
            <th className="text-right py-2 px-2 font-medium text-gray-500 whitespace-nowrap hidden sm:table-cell">총 매출</th>
            <th className="text-right py-2 px-2 font-medium text-gray-500 whitespace-nowrap hidden sm:table-cell">평균 판매</th>
            <th className="text-right py-2 px-2 font-medium text-gray-500 whitespace-nowrap">전체 대비</th>
            <th className="py-2 pl-2 font-medium text-gray-500 w-28 hidden md:table-cell">비중</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const pct = row.salesVsOverallAvgPercent;
            const isPositive = pct > 0;
            const isWeekend = row.isWeekend;

            return (
              <tr
                key={row.dayOfWeek}
                className={`border-b border-gray-100 last:border-0 ${
                  isWeekend ? "bg-amber-50/40" : ""
                } ${row.recordCount === 0 ? "opacity-40" : ""}`}
              >
                <td className="py-2.5 pr-3 font-medium text-gray-800 whitespace-nowrap">
                  {row.dayLabel}
                  {isWeekend && (
                    <span className="ml-1 text-[10px] text-amber-600 font-normal">주말</span>
                  )}
                </td>
                <td className="py-2.5 px-2 text-right text-gray-600">{row.recordCount}일</td>
                <td className="py-2.5 px-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                  {row.recordCount > 0 ? formatCurrencyNZD(row.avgSales) : "—"}
                </td>
                <td className="py-2.5 px-2 text-right text-gray-600 whitespace-nowrap hidden sm:table-cell">
                  {row.recordCount > 0 ? formatCurrencyNZD(row.totalSales) : "—"}
                </td>
                <td className="py-2.5 px-2 text-right text-gray-600 whitespace-nowrap hidden sm:table-cell">
                  {row.recordCount > 0 ? `${Math.round(row.avgBagelsSold)}개` : "—"}
                </td>
                <td className="py-2.5 px-2 text-right whitespace-nowrap">
                  {row.recordCount > 0 ? (
                    <span
                      className={`text-xs font-medium ${
                        Math.abs(pct) < 1
                          ? "text-gray-500"
                          : isPositive
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {isPositive ? "▲ +" : pct < -0.5 ? "▼ " : ""}
                      {formatPercentage(pct / 100)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2.5 pl-2 hidden md:table-cell">
                  {row.recordCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full transition-all"
                          style={{ width: `${(row.avgSales / maxAvgSales) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
