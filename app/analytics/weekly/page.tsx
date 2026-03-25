export const dynamic = "force-dynamic";

import { getWeeklyAnalytics } from "@/lib/services/analytics";
import { formatCurrencyNZD, formatPercentage } from "@/lib/analytics-utils";
import TrendBar from "@/components/analytics/TrendBar";

type SearchParams = { startDate?: string; endDate?: string };

export default async function WeeklyAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = sp.startDate
    ? new Date(sp.startDate)
    : new Date(endDate.getTime() - 84 * 24 * 60 * 60 * 1000); // ~12 weeks
  startDate.setHours(0, 0, 0, 0);

  if (sp.endDate) {
    const d = new Date(sp.endDate);
    d.setHours(23, 59, 59, 999);
    endDate.setTime(d.getTime());
  }

  const weeks = await getWeeklyAnalytics(startDate, endDate);
  const maxSales = Math.max(...weeks.map((w) => w.totalSales), 1);

  const bestWeek = weeks.length > 0
    ? weeks.reduce((best, w) => (w.totalSales > best.totalSales ? w : best))
    : null;
  const worstWeek = weeks.length > 0
    ? weeks.reduce((worst, w) => (w.totalSales < worst.totalSales ? w : worst))
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">📆 주별 분석</h1>
        <p className="text-gray-500 mt-1">
          {startDate.toLocaleDateString("ko-KR")} ~ {endDate.toLocaleDateString("ko-KR")}
          {" "}({weeks.length}주)
        </p>
      </div>

      {/* Best/Worst highlights */}
      {bestWeek && worstWeek && weeks.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-green-50 rounded-lg border border-green-200 p-4">
            <p className="text-xs text-green-600 font-medium mb-1">🏆 최고 주</p>
            <p className="font-semibold text-gray-900">{bestWeek.weekLabel}</p>
            <p className="text-lg font-bold text-green-700 mt-1">
              {formatCurrencyNZD(bestWeek.totalSales)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {bestWeek.recordCount}일 · 일평균 {formatCurrencyNZD(bestWeek.averageDailySales)}
            </p>
          </div>
          <div className="bg-red-50 rounded-lg border border-red-200 p-4">
            <p className="text-xs text-red-600 font-medium mb-1">📉 최저 주</p>
            <p className="font-semibold text-gray-900">{worstWeek.weekLabel}</p>
            <p className="text-lg font-bold text-red-700 mt-1">
              {formatCurrencyNZD(worstWeek.totalSales)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {worstWeek.recordCount}일 · 일평균 {formatCurrencyNZD(worstWeek.averageDailySales)}
            </p>
          </div>
        </div>
      )}

      {weeks.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-400">해당 기간에 데이터가 없습니다.</p>
        </div>
      ) : (
        <>
          {/* Bar Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">주별 총 매출</h3>
            <div className="space-y-2">
              {weeks.map((week) => (
                <div key={week.weekStart} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-24 flex-shrink-0">
                    {week.weekLabel}
                  </span>
                  <div className="flex-1">
                    <TrendBar
                      value={week.totalSales}
                      maxValue={maxSales}
                      color={
                        week.weekStart === bestWeek?.weekStart
                          ? "bg-green-500"
                          : week.weekStart === worstWeek?.weekStart
                          ? "bg-red-400"
                          : "bg-amber-500"
                      }
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-20 text-right flex-shrink-0">
                    {formatCurrencyNZD(week.totalSales)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="hidden lg:block bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">주</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">총 매출</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">일평균</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">판매 베이글</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">평균 폐기율</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">전주 대비</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {weeks.map((week, idx) => {
                  const prev = weeks[idx - 1];
                  const changePercent =
                    prev && prev.totalSales > 0
                      ? ((week.totalSales - prev.totalSales) / prev.totalSales) * 100
                      : null;
                  return (
                    <tr
                      key={week.weekStart}
                      className={`hover:bg-gray-50 ${
                        week.weekStart === bestWeek?.weekStart
                          ? "bg-green-50"
                          : week.weekStart === worstWeek?.weekStart
                          ? "bg-red-50"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {week.weekLabel}
                        <span className="text-xs text-gray-400 ml-2">({week.recordCount}일)</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatCurrencyNZD(week.totalSales)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatCurrencyNZD(week.averageDailySales)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {week.totalBagelsSold}개
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          week.wasteRate > 0.1 ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {formatPercentage(week.wasteRate)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {changePercent !== null ? (
                          <span
                            className={`text-xs font-medium ${
                              changePercent > 0
                                ? "text-green-600"
                                : changePercent < 0
                                ? "text-red-600"
                                : "text-gray-500"
                            }`}
                          >
                            {changePercent > 0 ? "▲ +" : changePercent < 0 ? "▼ " : ""}
                            {changePercent.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {weeks.map((week, idx) => {
              const prev = weeks[idx - 1];
              const changePercent =
                prev && prev.totalSales > 0
                  ? ((week.totalSales - prev.totalSales) / prev.totalSales) * 100
                  : null;
              return (
                <div key={week.weekStart} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-gray-900">{week.weekLabel}</span>
                    <span className="font-semibold text-amber-700">
                      {formatCurrencyNZD(week.totalSales)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 flex gap-3">
                    <span>일평균 {formatCurrencyNZD(week.averageDailySales)}</span>
                    <span>폐기율 {formatPercentage(week.wasteRate)}</span>
                    {changePercent !== null && (
                      <span className={changePercent >= 0 ? "text-green-600" : "text-red-600"}>
                        {changePercent >= 0 ? "▲ +" : "▼ "}{changePercent.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
