export const dynamic = "force-dynamic";

import {
  getHolidaySegmentComparison,
  getSchoolHolidaySegmentComparison,
  getRainSegmentComparison,
  getEventSegmentComparison,
  getHolidayNameBreakdown,
} from "@/lib/services/analytics";
import { formatCurrencyNZD, formatPercentage } from "@/lib/analytics-utils";
import ComparisonCard from "@/components/analytics/ComparisonCard";

type SearchParams = { startDate?: string; endDate?: string };

export default async function SegmentsPage({
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

  const [holiday, schoolHoliday, rain, event, holidayBreakdown] =
    await Promise.all([
      getHolidaySegmentComparison(startDate, endDate),
      getSchoolHolidaySegmentComparison(startDate, endDate),
      getRainSegmentComparison(startDate, endDate),
      getEventSegmentComparison(startDate, endDate),
      getHolidayNameBreakdown(startDate, endDate),
    ]);

  const segments = [
    {
      result: holiday,
      icon: "🎌",
      title: "Holiday vs Regular days",
      segmentLabel: `Holiday (${holiday.segment.recordCount} days)`,
      baselineLabel: `Regular days (${holiday.baseline.recordCount} days)`,
    },
    {
      result: schoolHoliday,
      icon: "🏫",
      title: "School Holiday vs In-term",
      segmentLabel: `School Holiday (${schoolHoliday.segment.recordCount} days)`,
      baselineLabel: `In-term (${schoolHoliday.baseline.recordCount} days)`,
    },
    {
      result: rain,
      icon: "🌧️",
      title: "Rainy days vs Clear days",
      segmentLabel: `Rainy days (${rain.segment.recordCount} days)`,
      baselineLabel: `Clear days (${rain.baseline.recordCount} days)`,
    },
    {
      result: event,
      icon: "🎪",
      title: "Days with Event vs Regular days",
      segmentLabel: `Event (${event.segment.recordCount} days)`,
      baselineLabel: `Regular days (${event.baseline.recordCount} days)`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🔍 segments Analytics</h1>
        <p className="text-gray-500 mt-1">
          Compare sales and operational metrics by condition
        </p>
      </div>

      {/* Segment Cards */}
      <div className="space-y-8">
        {segments.map(({ result, icon, title, segmentLabel, baselineLabel }) => (
          <div key={result.segmentName} className="space-y-3">
            <h2 className="text-base font-semibold text-gray-900">
              {icon} {title}
            </h2>
            {result.segment.recordCount === 0 ? (
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-sm text-gray-400 text-center">
                No data for this segment..
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <ComparisonCard
                  title="Daily Avg. Sales"
                  segmentLabel={segmentLabel}
                  baselineLabel={baselineLabel}
                  segmentValue={formatCurrencyNZD(result.segment.averageDailySales)}
                  baselineValue={formatCurrencyNZD(result.baseline.averageDailySales)}
                  diffPercent={result.salesDiffPercent}
                  higherIsBetter={true}
                />
                <ComparisonCard
                  title="Daily Avg. Sold Bagels"
                  segmentLabel={segmentLabel}
                  baselineLabel={baselineLabel}
                  segmentValue={`${Math.round(result.segment.averageBagelsSold)}`}
                  baselineValue={`${Math.round(result.baseline.averageBagelsSold)}`}
                  diffPercent={result.bagelsSoldDiffPercent}
                  unit=""
                  higherIsBetter={true}
                />
                <ComparisonCard
                  title="Avg. Waste Rate"
                  segmentLabel={segmentLabel}
                  baselineLabel={baselineLabel}
                  segmentValue={formatPercentage(result.segment.wasteRate)}
                  baselineValue={formatPercentage(result.baseline.wasteRate)}
                  diffPercent={result.wasteRateDiff * 100}
                  higherIsBetter={false}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Holiday Name Breakdown */}
      {holidayBreakdown.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">🎌 Holiday Details</h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Holiday Name</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Record Count</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg. Sales</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg. Sold</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg. Waste Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {holidayBreakdown.map((h) => (
                  <tr key={h.holidayName} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{h.holidayName}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{h.recordCount} days</td>
                    <td className="px-4 py-3 text-right font-medium text-amber-700">
                      {formatCurrencyNZD(h.avgSales)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {Math.round(h.avgBagelsSold)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        h.avgWasteRate > 0.1 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {formatPercentage(h.avgWasteRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
