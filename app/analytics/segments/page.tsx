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
      title: "공휴일 vs 일반일",
      segmentLabel: `공휴일 (${holiday.segment.recordCount}일)`,
      baselineLabel: `일반일 (${holiday.baseline.recordCount}일)`,
    },
    {
      result: schoolHoliday,
      icon: "🏫",
      title: "학교 방학 vs 학기 중",
      segmentLabel: `방학 (${schoolHoliday.segment.recordCount}일)`,
      baselineLabel: `학기 중 (${schoolHoliday.baseline.recordCount}일)`,
    },
    {
      result: rain,
      icon: "🌧️",
      title: "비 오는 날 vs 맑은 날",
      segmentLabel: `비 오는 날 (${rain.segment.recordCount}일)`,
      baselineLabel: `맑은 날 (${rain.baseline.recordCount}일)`,
    },
    {
      result: event,
      icon: "🎪",
      title: "이벤트 있는 날 vs 일반일",
      segmentLabel: `이벤트 (${event.segment.recordCount}일)`,
      baselineLabel: `일반일 (${event.baseline.recordCount}일)`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🔍 세그먼트 분석</h1>
        <p className="text-gray-500 mt-1">
          조건별 매출 및 운영 지표 비교
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
                해당 세그먼트의 데이터가 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <ComparisonCard
                  title="평균 일 매출"
                  segmentLabel={segmentLabel}
                  baselineLabel={baselineLabel}
                  segmentValue={formatCurrencyNZD(result.segment.averageDailySales)}
                  baselineValue={formatCurrencyNZD(result.baseline.averageDailySales)}
                  diffPercent={result.salesDiffPercent}
                  higherIsBetter={true}
                />
                <ComparisonCard
                  title="평균 일 판매 베이글"
                  segmentLabel={segmentLabel}
                  baselineLabel={baselineLabel}
                  segmentValue={`${Math.round(result.segment.averageBagelsSold)}`}
                  baselineValue={`${Math.round(result.baseline.averageBagelsSold)}`}
                  diffPercent={result.bagelsSoldDiffPercent}
                  unit="개"
                  higherIsBetter={true}
                />
                <ComparisonCard
                  title="평균 폐기율"
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
          <h2 className="text-base font-semibold text-gray-900 mb-3">🎌 공휴일별 상세</h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">공휴일명</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">기록 수</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">평균 매출</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">평균 판매</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">평균 폐기율</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {holidayBreakdown.map((h) => (
                  <tr key={h.holidayName} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{h.holidayName}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{h.recordCount}일</td>
                    <td className="px-4 py-3 text-right font-medium text-amber-700">
                      {formatCurrencyNZD(h.avgSales)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {Math.round(h.avgBagelsSold)}개
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
