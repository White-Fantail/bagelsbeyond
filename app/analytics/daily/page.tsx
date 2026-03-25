export const dynamic = "force-dynamic";

import { getDailyAnalytics, getPeriodSummary } from "@/lib/services/analytics";
import { formatCurrencyNZD, formatPercentage } from "@/lib/analytics-utils";
import TrendBar from "@/components/analytics/TrendBar";
import ChannelBar from "@/components/analytics/ChannelBar";

type SearchParams = { startDate?: string; endDate?: string };

export default async function DailyAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = sp.startDate
    ? new Date(sp.startDate)
    : new Date(endDate.getTime() - 14 * 24 * 60 * 60 * 1000);
  startDate.setHours(0, 0, 0, 0);

  if (sp.endDate) {
    const d = new Date(sp.endDate);
    d.setHours(23, 59, 59, 999);
    endDate.setTime(d.getTime());
  }

  const [items, summary] = await Promise.all([
    getDailyAnalytics(startDate, endDate),
    getPeriodSummary(startDate, endDate),
  ]);

  const maxSales = Math.max(...items.map((i) => i.totalSales), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">📅 일별 분석</h1>
        <p className="text-gray-500 mt-1">
          {startDate.toLocaleDateString("ko-KR")} ~ {endDate.toLocaleDateString("ko-KR")}
          {" "}({items.length}일)
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-t-4 border-t-amber-500 border-gray-200 p-4">
          <p className="text-sm text-gray-500">총 매출</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {formatCurrencyNZD(summary.totalSales)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-t-4 border-t-blue-500 border-gray-200 p-4">
          <p className="text-sm text-gray-500">일평균 매출</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {formatCurrencyNZD(summary.averageDailySales)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-t-4 border-t-green-500 border-gray-200 p-4">
          <p className="text-sm text-gray-500">총 판매 베이글</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{summary.totalBagelsSold}개</p>
        </div>
        <div className="bg-white rounded-lg border border-t-4 border-t-red-500 border-gray-200 p-4">
          <p className="text-sm text-gray-500">평균 폐기율</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {formatPercentage(summary.wasteRate)}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-400">해당 기간에 데이터가 없습니다.</p>
        </div>
      ) : (
        <>
          {/* Sales Trend Bar Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">매출 추이</h3>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.date} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-20 flex-shrink-0">
                    {new Date(item.date).toLocaleDateString("ko-KR", {
                      month: "2-digit",
                      day: "2-digit",
                    })}
                  </span>
                  <div className="flex-1">
                    <TrendBar
                      value={item.totalSales}
                      maxValue={maxSales}
                      color={item.isHoliday ? "bg-amber-400" : "bg-amber-500"}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-20 text-right flex-shrink-0">
                    {formatCurrencyNZD(item.totalSales)}
                  </span>
                  <div className="flex gap-1 w-16 flex-shrink-0">
                    {item.isHoliday && (
                      <span title={item.holidayName ?? "공휴일"} className="text-xs">🎌</span>
                    )}
                    {item.isSchoolHoliday && (
                      <span title="학교 방학" className="text-xs">🏫</span>
                    )}
                    {item.isRainy && (
                      <span title={`비 ${item.rainMm}mm`} className="text-xs">🌧️</span>
                    )}
                    {item.localEventName && (
                      <span title={item.localEventName} className="text-xs">🎪</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detail Table — desktop */}
          <div className="hidden lg:block bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">총매출</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">판매</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">폐기율</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">채널</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">외부요인</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item) => (
                  <tr key={item.date} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {new Date(item.date).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrencyNZD(item.totalSales)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {item.bagelsSold}개
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        item.wasteRate > 0.1 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {formatPercentage(item.wasteRate)}
                    </td>
                    <td className="px-4 py-3 w-36">
                      <ChannelBar
                        storePercent={
                          item.totalSales > 0
                            ? (item.storeSales / item.totalSales) * 100
                            : 0
                        }
                        uberPercent={
                          item.totalSales > 0
                            ? (item.uberSales / item.totalSales) * 100
                            : 0
                        }
                        doordashPercent={
                          item.totalSales > 0
                            ? (item.doordashSales / item.totalSales) * 100
                            : 0
                        }
                        otherPercent={
                          item.totalSales > 0
                            ? (item.otherSales / item.totalSales) * 100
                            : 0
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {item.isHoliday && (
                          <span
                            title={item.holidayName ?? "공휴일"}
                            className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs"
                          >
                            {item.holidayName ?? "공휴일"}
                          </span>
                        )}
                        {item.isSchoolHoliday && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                            학교방학
                          </span>
                        )}
                        {item.isRainy && (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                            비 {item.rainMm}mm
                          </span>
                        )}
                        {item.localEventName && (
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                            {item.localEventName}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {items.map((item) => (
              <div
                key={item.date}
                className="bg-white rounded-lg border border-gray-200 p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-gray-900">
                    {new Date(item.date).toLocaleDateString("ko-KR")}
                  </span>
                  <span className="font-semibold text-amber-700">
                    {formatCurrencyNZD(item.totalSales)}
                  </span>
                </div>
                <div className="text-sm text-gray-500 flex gap-3 mb-2">
                  <span>판매 {item.bagelsSold}개</span>
                  <span>폐기율 {formatPercentage(item.wasteRate)}</span>
                </div>
                <ChannelBar
                  storePercent={item.totalSales > 0 ? (item.storeSales / item.totalSales) * 100 : 0}
                  uberPercent={item.totalSales > 0 ? (item.uberSales / item.totalSales) * 100 : 0}
                  doordashPercent={item.totalSales > 0 ? (item.doordashSales / item.totalSales) * 100 : 0}
                  otherPercent={item.totalSales > 0 ? (item.otherSales / item.totalSales) * 100 : 0}
                />
                {(item.isHoliday || item.isSchoolHoliday || item.isRainy || item.localEventName) && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.isHoliday && (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                        {item.holidayName ?? "공휴일"}
                      </span>
                    )}
                    {item.isSchoolHoliday && (
                      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                        학교방학
                      </span>
                    )}
                    {item.isRainy && (
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        비 {item.rainMm}mm
                      </span>
                    )}
                    {item.localEventName && (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                        {item.localEventName}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
