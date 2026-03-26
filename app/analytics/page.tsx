export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  getPeriodSummary,
  getPeriodComparison,
  getWeeklyAnalytics,
  getHolidaySegmentComparison,
  getSchoolHolidaySegmentComparison,
  getDayOfWeekAnalytics,
} from "@/lib/services/analytics";
import { buildComparablePreviousPeriod, formatCurrencyNZD, formatPercentage, startOfMonth, endOfMonth } from "@/lib/analytics-utils";
import PeriodComparisonSection from "@/components/analytics/PeriodComparisonSection";
import TrendBar from "@/components/analytics/TrendBar";
import ChannelBar from "@/components/analytics/ChannelBar";
import DayOfWeekTable from "@/components/analytics/DayOfWeekTable";

type SearchParams = { period?: string };

function getPeriodDates(period: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  switch (period) {
    case "7d": {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: now };
    }
    case "90d": {
      const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: now };
    }
    case "thisMonth": {
      const start = startOfMonth(now);
      return { startDate: start, endDate: now };
    }
    case "lastMonth": {
      const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastOfLastMonth = new Date(firstOfThisMonth.getTime() - 1);
      const firstOfLastMonth = startOfMonth(lastOfLastMonth);
      return { startDate: firstOfLastMonth, endDate: endOfMonth(firstOfLastMonth) };
    }
    case "30d":
    default: {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: now };
    }
  }
}

const PERIOD_OPTIONS = [
  { value: "7d", label: "최근 7일" },
  { value: "30d", label: "최근 30일" },
  { value: "90d", label: "최근 90일" },
  { value: "thisMonth", label: "이번 달" },
  { value: "lastMonth", label: "지난 달" },
];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const period = sp.period ?? "30d";
  const { startDate, endDate } = getPeriodDates(period);

  const { previousStart, previousEnd } = buildComparablePreviousPeriod(startDate, endDate);

  // 8-week range for mini chart
  const eightWeeksAgo = new Date(endDate.getTime() - 56 * 24 * 60 * 60 * 1000);
  eightWeeksAgo.setHours(0, 0, 0, 0);

  const [summary, comparison, weeklyData, holidaySeg, schoolHolidaySeg, dayOfWeekData] =
    await Promise.all([
      getPeriodSummary(startDate, endDate),
      getPeriodComparison(startDate, endDate, previousStart, previousEnd),
      getWeeklyAnalytics(eightWeeksAgo, endDate),
      getHolidaySegmentComparison(startDate, endDate),
      getSchoolHolidaySegmentComparison(startDate, endDate),
      getDayOfWeekAnalytics(startDate, endDate),
    ]);

  const maxWeeklySales = Math.max(...weeklyData.map((w) => w.totalSales), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">📊 매출 분석</h1>
        <p className="text-gray-500 mt-1">
          {startDate.toLocaleDateString("ko-KR")} ~ {endDate.toLocaleDateString("ko-KR")}
        </p>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2 flex-wrap">
        {PERIOD_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={`/analytics?period=${opt.value}`}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              period === opt.value
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:text-amber-700"
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-t-4 border-t-amber-500 border-gray-200 p-5">
          <p className="text-sm text-gray-500">총 매출</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrencyNZD(summary.totalSales)}
          </p>
          <p className="text-xs text-gray-400 mt-1">{summary.recordCount}일 기록</p>
        </div>
        <div className="bg-white rounded-lg border border-t-4 border-t-blue-500 border-gray-200 p-5">
          <p className="text-sm text-gray-500">일평균 매출</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrencyNZD(summary.averageDailySales)}
          </p>
          <p className="text-xs text-gray-400 mt-1">기간 평균</p>
        </div>
        <div className="bg-white rounded-lg border border-t-4 border-t-green-500 border-gray-200 p-5">
          <p className="text-sm text-gray-500">총 판매 베이글</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {summary.totalBagelsSold}개
          </p>
          <p className="text-xs text-gray-400 mt-1">
            일평균 {Math.round(summary.averageBagelsSold)}개
          </p>
        </div>
        <div className="bg-white rounded-lg border border-t-4 border-t-red-500 border-gray-200 p-5">
          <p className="text-sm text-gray-500">평균 폐기율</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatPercentage(summary.wasteRate)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            판매율 {formatPercentage(summary.sellThroughRate)}
          </p>
        </div>
      </div>

      {/* Channel Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">채널별 매출 비중</h3>
        <ChannelBar
          storePercent={summary.storePercent}
          uberPercent={summary.uberPercent}
          doordashPercent={summary.doordashPercent}
          otherPercent={summary.otherPercent}
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { label: "매장", amount: summary.storeSales, pct: summary.storePercent, color: "bg-blue-500" },
            { label: "우버이츠", amount: summary.uberSales, pct: summary.uberPercent, color: "bg-green-500" },
            { label: "도어대쉬", amount: summary.doordashSales, pct: summary.doordashPercent, color: "bg-red-500" },
            { label: "기타", amount: summary.otherSales, pct: summary.otherPercent, color: "bg-gray-400" },
          ].map((ch) => (
            <div key={ch.label} className="text-center">
              <div className={`inline-block w-3 h-3 rounded-full ${ch.color} mb-1`} />
              <p className="text-xs text-gray-500">{ch.label}</p>
              <p className="text-sm font-semibold text-gray-800">
                {formatCurrencyNZD(ch.amount)}
              </p>
              <p className="text-xs text-gray-400">{ch.pct.toFixed(1)}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* Period Comparison */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">기간 비교</h2>
        <PeriodComparisonSection comparison={comparison} />
      </div>

      {/* Weekly Trend Mini Chart */}
      {weeklyData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">주별 매출 추이 (최근 8주)</h3>
            <Link href="/analytics/weekly" className="text-xs text-amber-600 hover:underline">
              주별 분석 →
            </Link>
          </div>
          <div className="space-y-2">
            {weeklyData.slice(-8).map((week) => (
              <div key={week.weekStart} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-24 flex-shrink-0">
                  {week.weekLabel}
                </span>
                <div className="flex-1">
                  <TrendBar value={week.totalSales} maxValue={maxWeeklySales} />
                </div>
                <span className="text-xs font-medium text-gray-700 w-20 text-right flex-shrink-0">
                  {formatCurrencyNZD(week.totalSales)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Holiday / School Holiday Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {holidaySeg.segment.recordCount > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">🎌 공휴일 영향</h3>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">공휴일 평균 매출</span>
              <span className="font-semibold text-amber-700">
                {formatCurrencyNZD(holidaySeg.segment.averageDailySales)}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-500">일반일 평균 매출</span>
              <span className="font-medium text-gray-700">
                {formatCurrencyNZD(holidaySeg.baseline.averageDailySales)}
              </span>
            </div>
            <div
              className={`mt-2 text-xs font-medium ${
                holidaySeg.salesDiffPercent >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {holidaySeg.salesDiffPercent >= 0 ? "▲ +" : "▼ "}
              {holidaySeg.salesDiffPercent.toFixed(1)}% 차이
            </div>
            <Link href="/analytics/segments" className="text-xs text-amber-600 hover:underline mt-2 block">
              세그먼트 상세 →
            </Link>
          </div>
        )}
        {schoolHolidaySeg.segment.recordCount > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">🏫 학교 방학 영향</h3>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">방학 기간 평균 매출</span>
              <span className="font-semibold text-amber-700">
                {formatCurrencyNZD(schoolHolidaySeg.segment.averageDailySales)}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-500">학기 중 평균 매출</span>
              <span className="font-medium text-gray-700">
                {formatCurrencyNZD(schoolHolidaySeg.baseline.averageDailySales)}
              </span>
            </div>
            <div
              className={`mt-2 text-xs font-medium ${
                schoolHolidaySeg.salesDiffPercent >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {schoolHolidaySeg.salesDiffPercent >= 0 ? "▲ +" : "▼ "}
              {schoolHolidaySeg.salesDiffPercent.toFixed(1)}% 차이
            </div>
            <Link href="/analytics/segments" className="text-xs text-amber-600 hover:underline mt-2 block">
              세그먼트 상세 →
            </Link>
          </div>
        )}
      </div>

      {/* Day-of-Week Analysis */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">📅 요일별 분석</h3>
            <p className="text-xs text-gray-400 mt-0.5">선택 기간 내 요일별 평균 매출 및 판매량</p>
          </div>
        </div>
        <DayOfWeekTable data={dayOfWeekData} />
        <p className="text-xs text-gray-400 mt-3">
          * 전체 대비: 해당 기간 일평균 매출 대비 각 요일 평균 매출의 증감률
        </p>
      </div>

      {/* Quick Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/analytics/daily", label: "📅 일별 분석", desc: "날짜별 상세" },
          { href: "/analytics/weekly", label: "📆 주별 분석", desc: "주간 트렌드" },
          { href: "/analytics/monthly", label: "🗓️ 월별 분석", desc: "월간 요약" },
          { href: "/analytics/segments", label: "🔍 세그먼트", desc: "조건별 비교" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:border-amber-300 hover:bg-amber-50 transition-colors text-center"
          >
            <p className="font-medium text-gray-800 text-sm">{item.label}</p>
            <p className="text-xs text-gray-400 mt-1">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
