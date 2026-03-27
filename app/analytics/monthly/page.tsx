export const dynamic = "force-dynamic";

import { getMonthlyAnalytics } from "@/lib/services/analytics";
import { formatCurrencyNZD, formatPercentage } from "@/lib/analytics-utils";
import TrendBar from "@/components/analytics/TrendBar";

type SearchParams = { startDate?: string; endDate?: string };

export default async function MonthlyAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = sp.startDate ? new Date(sp.startDate) : new Date(0);
  startDate.setHours(0, 0, 0, 0);

  if (sp.endDate) {
    const d = new Date(sp.endDate);
    d.setHours(23, 59, 59, 999);
    endDate.setTime(d.getTime());
  }

  const months = await getMonthlyAnalytics(startDate, endDate);
  const maxSales = Math.max(...months.map((m) => m.totalSales), 1);

  const bestMonth = months.length > 0
    ? months.reduce((best, m) => (m.totalSales > best.totalSales ? m : best))
    : null;
  const worstMonth = months.length > 0
    ? months.reduce((worst, m) => (m.totalSales < worst.totalSales ? m : worst))
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🗓️ monthly Analytics</h1>
        <p className="text-gray-500 mt-1">
          Full Period ({months.length}months)
        </p>
      </div>

      {/* Best/Worst highlights */}
      {bestMonth && worstMonth && months.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-green-50 rounded-lg border border-green-200 p-4">
            <p className="text-xs text-green-600 font-medium mb-1">🏆 Best Month</p>
            <p className="font-semibold text-gray-900">{bestMonth.monthLabel}</p>
            <p className="text-lg font-bold text-green-700 mt-1">
              {formatCurrencyNZD(bestMonth.totalSales)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {bestMonth.recordCount} days · Daily Avg. {formatCurrencyNZD(bestMonth.averageDailySales)}
            </p>
          </div>
          <div className="bg-red-50 rounded-lg border border-red-200 p-4">
            <p className="text-xs text-red-600 font-medium mb-1">📉 Worst Month</p>
            <p className="font-semibold text-gray-900">{worstMonth.monthLabel}</p>
            <p className="text-lg font-bold text-red-700 mt-1">
              {formatCurrencyNZD(worstMonth.totalSales)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {worstMonth.recordCount} days · Daily Avg. {formatCurrencyNZD(worstMonth.averageDailySales)}
            </p>
          </div>
        </div>
      )}

      {months.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-400">No data.</p>
        </div>
      ) : (
        <>
          {/* Bar Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Total Sales</h3>
            <div className="space-y-2">
              {months.map((month) => (
                <div key={`${month.year}-${month.month}`} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-24 flex-shrink-0">
                    {month.monthLabel}
                  </span>
                  <div className="flex-1">
                    <TrendBar
                      value={month.totalSales}
                      maxValue={maxSales}
                      color={
                        month.monthLabel === bestMonth?.monthLabel
                          ? "bg-green-500"
                          : month.monthLabel === worstMonth?.monthLabel
                          ? "bg-red-400"
                          : "bg-amber-500"
                      }
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-20 text-right flex-shrink-0">
                    {formatCurrencyNZD(month.totalSales)}
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Sales</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Daily Avg.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sold Bagels</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg. Waste Rate</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">vs. Last Month</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Channel Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {months.map((month, idx) => {
                  const prev = months[idx - 1];
                  const changePercent =
                    prev && prev.totalSales > 0
                      ? ((month.totalSales - prev.totalSales) / prev.totalSales) * 100
                      : null;
                  return (
                    <tr
                      key={`${month.year}-${month.month}`}
                      className={`hover:bg-gray-50 ${
                        month.monthLabel === bestMonth?.monthLabel
                          ? "bg-green-50"
                          : month.monthLabel === worstMonth?.monthLabel
                          ? "bg-red-50"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {month.monthLabel}
                        <span className="text-xs text-gray-400 ml-2">({month.recordCount} days)</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatCurrencyNZD(month.totalSales)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatCurrencyNZD(month.averageDailySales)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {month.totalBagelsSold}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          month.wasteRate > 0.1 ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {formatPercentage(month.wasteRate)}
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
                      <td className="px-4 py-3 text-xs text-gray-500">
                        <span className="text-blue-600">Store {month.storePercent.toFixed(0)}%</span>
                        {" · "}
                        <span className="text-green-600">Uber {month.uberPercent.toFixed(0)}%</span>
                        {" · "}
                        <span className="text-red-600">Dash {month.doordashPercent.toFixed(0)}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {months.map((month, idx) => {
              const prev = months[idx - 1];
              const changePercent =
                prev && prev.totalSales > 0
                  ? ((month.totalSales - prev.totalSales) / prev.totalSales) * 100
                  : null;
              return (
                <div key={`${month.year}-${month.month}`} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-gray-900">{month.monthLabel}</span>
                    <span className="font-semibold text-amber-700">
                      {formatCurrencyNZD(month.totalSales)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 flex flex-wrap gap-3">
                    <span>Daily Avg. {formatCurrencyNZD(month.averageDailySales)}</span>
                    <span>Waste Rate {formatPercentage(month.wasteRate)}</span>
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
