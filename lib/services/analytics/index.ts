import { prisma } from "@/lib/db";
import type { DailyRecord, DailyExternalFactor } from "@/types";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  formatWeekLabel,
  formatMonthLabel,
  safeDivide,
} from "@/lib/analytics-utils";

export type RecordWithFactor = DailyRecord & { externalFactor: DailyExternalFactor | null };

export type PeriodSummary = {
  startDate: string;
  endDate: string;
  recordCount: number;
  totalSales: number;
  averageDailySales: number;
  totalBagelsSold: number;
  averageBagelsSold: number;
  totalBagelsBaked: number;
  totalLeftovers: number;
  wasteRate: number;
  sellThroughRate: number;
  storeSales: number;
  uberSales: number;
  doordashSales: number;
  otherSales: number;
  storePercent: number;
  uberPercent: number;
  doordashPercent: number;
  otherPercent: number;
};

export type DailyAnalyticsItem = {
  date: string;
  totalSales: number;
  storeSales: number;
  uberSales: number;
  doordashSales: number;
  otherSales: number;
  bagelsBaked: number;
  bagelsSold: number;
  bagelsLeft: number;
  wasteRate: number;
  sellThroughRate: number;
  isHoliday: boolean;
  holidayName: string | null;
  isSchoolHoliday: boolean;
  isRainy: boolean;
  rainMm: number;
  localEventName: string | null;
  weatherSummary: string | null;
};

export type WeeklyAnalyticsItem = PeriodSummary & {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  weekNumber: number;
};

export type MonthlyAnalyticsItem = PeriodSummary & {
  monthLabel: string;
  year: number;
  month: number;
};

export type PeriodComparison = {
  current: PeriodSummary;
  previous: PeriodSummary;
  salesChange: number;
  salesChangePercent: number;
  avgSalesChange: number;
  avgSalesChangePercent: number;
  bagelsSoldChange: number;
  bagelsSoldChangePercent: number;
  wasteRateChange: number;
  storePercentChange: number;
  uberPercentChange: number;
  doordashPercentChange: number;
};

export type SegmentResult = {
  segmentName: string;
  segmentLabel: string;
  segment: PeriodSummary;
  baseline: PeriodSummary;
  salesDiffPercent: number;
  bagelsSoldDiffPercent: number;
  wasteRateDiff: number;
};

export type HolidayBreakdown = {
  holidayName: string;
  recordCount: number;
  avgSales: number;
  avgBagelsSold: number;
  avgWasteRate: number;
};

export type DayOfWeekAnalyticsItem = {
  /** 0 = Sunday … 6 = Saturday */
  dayOfWeek: number;
  dayLabel: string;
  recordCount: number;
  totalSales: number;
  avgSales: number;
  totalBagelsSold: number;
  avgBagelsSold: number;
  avgWasteRate: number;
  /** Deviation from the overall period average sales (fractional, e.g. 0.12 = +12%) */
  salesVsOverallAvgPercent: number;
  isWeekend: boolean;
};

// ─── Helper ──────────────────────────────────────────────────────────────────

function recordTotalSales(r: RecordWithFactor): number {
  return r.storeSales + r.uberSales + r.doordashSales + r.otherSales;
}

export function computePeriodSummary(
  records: RecordWithFactor[],
  startDate: Date,
  endDate: Date
): PeriodSummary {
  const count = records.length;

  const totalSales = records.reduce((s, r) => s + recordTotalSales(r), 0
  );
  const storeSales = records.reduce((s, r) => s + r.storeSales, 0);
  const uberSales = records.reduce((s, r) => s + r.uberSales, 0);
  const doordashSales = records.reduce((s, r) => s + r.doordashSales, 0);
  const otherSales = records.reduce((s, r) => s + r.otherSales, 0);

  const totalBagelsBaked = records.reduce((s, r) => s + r.bagelsBaked, 0);
  const totalLeftovers = records.reduce((s, r) => s + r.bagelsLeft, 0);
  const totalBagelsSold = totalBagelsBaked - totalLeftovers;

  const wasteRate =
    count > 0
      ? records.reduce(
          (s, r) => s + safeDivide(r.bagelsLeft, r.bagelsBaked),
          0
        ) / count
      : 0;

  const sellThroughRate =
    count > 0
      ? records.reduce(
          (s, r) =>
            s + safeDivide(r.bagelsBaked - r.bagelsLeft, r.bagelsBaked),
          0
        ) / count
      : 0;

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
    recordCount: count,
    totalSales,
    averageDailySales: safeDivide(totalSales, count),
    totalBagelsSold,
    averageBagelsSold: safeDivide(totalBagelsSold, count),
    totalBagelsBaked,
    totalLeftovers,
    wasteRate,
    sellThroughRate,
    storeSales,
    uberSales,
    doordashSales,
    otherSales,
    storePercent: safeDivide(storeSales, totalSales) * 100,
    uberPercent: safeDivide(uberSales, totalSales) * 100,
    doordashPercent: safeDivide(doordashSales, totalSales) * 100,
    otherPercent: safeDivide(otherSales, totalSales) * 100,
  };
}

async function fetchRecordsInRange(
  startDate: Date,
  endDate: Date
): Promise<RecordWithFactor[]> {
  const records = await prisma.dailyRecord.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: "asc" },
    include: { externalFactor: true },
  });
  return records as RecordWithFactor[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getDailyAnalytics(
  startDate: Date,
  endDate: Date
): Promise<DailyAnalyticsItem[]> {
  const records = await fetchRecordsInRange(startDate, endDate);

  return records.map((r) => {
    const ef = r.externalFactor;
    const totalSales = recordTotalSales(r);
    const bagelsSold = r.bagelsBaked - r.bagelsLeft;

    return {
      date: new Date(r.date).toISOString().split("T")[0],
      totalSales,
      storeSales: r.storeSales,
      uberSales: r.uberSales,
      doordashSales: r.doordashSales,
      otherSales: r.otherSales,
      bagelsBaked: r.bagelsBaked,
      bagelsSold,
      bagelsLeft: r.bagelsLeft,
      wasteRate: safeDivide(r.bagelsLeft, r.bagelsBaked),
      sellThroughRate: safeDivide(bagelsSold, r.bagelsBaked),
      isHoliday: ef?.holidayName != null && ef.holidayName.length > 0,
      holidayName: ef?.holidayName ?? null,
      isSchoolHoliday: ef?.schoolHoliday ?? false,
      isRainy: (ef?.rainMm ?? 0) > 0,
      rainMm: ef?.rainMm ?? 0,
      localEventName: ef?.localEventName ?? null,
      weatherSummary: ef?.weatherSummary ?? null,
    };
  });
}

export async function getWeeklyAnalytics(
  startDate: Date,
  endDate: Date
): Promise<WeeklyAnalyticsItem[]> {
  const records = await fetchRecordsInRange(startDate, endDate);

  // Group records by Monday of their week
  const weekMap = new Map<string, RecordWithFactor[]>();
  for (const r of records) {
    const weekStart = startOfWeek(new Date(r.date));
    const key = weekStart.toISOString().split("T")[0];
    if (!weekMap.has(key)) weekMap.set(key, []);
    weekMap.get(key)!.push(r);
  }

  const result: WeeklyAnalyticsItem[] = [];
  let weekNumber = 1;

  const sortedKeys = Array.from(weekMap.keys()).sort();
  for (const key of sortedKeys) {
    const weekRecords = weekMap.get(key)!;
    const weekStart = new Date(key);
    const weekEnd = endOfWeek(weekStart);

    const summary = computePeriodSummary(weekRecords, weekStart, weekEnd);

    result.push({
      ...summary,
      weekLabel: formatWeekLabel(weekStart, weekEnd),
      weekStart: weekStart.toISOString().split("T")[0],
      weekEnd: weekEnd.toISOString().split("T")[0],
      weekNumber: weekNumber++,
    });
  }

  return result;
}

export async function getMonthlyAnalytics(
  startDate: Date,
  endDate: Date
): Promise<MonthlyAnalyticsItem[]> {
  const records = await fetchRecordsInRange(startDate, endDate);

  // Group records by year-month
  const monthMap = new Map<string, RecordWithFactor[]>();
  for (const r of records) {
    const d = new Date(r.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap.has(key)) monthMap.set(key, []);
    monthMap.get(key)!.push(r);
  }

  const result: MonthlyAnalyticsItem[] = [];
  const sortedKeys = Array.from(monthMap.keys()).sort();

  for (const key of sortedKeys) {
    const monthRecords = monthMap.get(key)!;
    const [yearStr, monthStr] = key.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const mStart = startOfMonth(new Date(year, month - 1, 1));
    const mEnd = endOfMonth(mStart);

    const summary = computePeriodSummary(monthRecords, mStart, mEnd);

    result.push({
      ...summary,
      monthLabel: formatMonthLabel(year, month),
      year,
      month,
    });
  }

  return result;
}

export async function getPeriodSummary(
  startDate: Date,
  endDate: Date
): Promise<PeriodSummary> {
  const records = await fetchRecordsInRange(startDate, endDate);
  return computePeriodSummary(records, startDate, endDate);
}

export async function getPeriodComparison(
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date
): Promise<PeriodComparison> {
  const [currentRecords, previousRecords] = await Promise.all([
    fetchRecordsInRange(currentStart, currentEnd),
    fetchRecordsInRange(previousStart, previousEnd),
  ]);

  const current = computePeriodSummary(currentRecords, currentStart, currentEnd);
  const previous = computePeriodSummary(previousRecords, previousStart, previousEnd);

  return {
    current,
    previous,
    salesChange: current.totalSales - previous.totalSales,
    salesChangePercent:
      previous.totalSales > 0
        ? ((current.totalSales - previous.totalSales) / previous.totalSales) * 100
        : 0,
    avgSalesChange: current.averageDailySales - previous.averageDailySales,
    avgSalesChangePercent:
      previous.averageDailySales > 0
        ? ((current.averageDailySales - previous.averageDailySales) /
            previous.averageDailySales) *
          100
        : 0,
    bagelsSoldChange: current.totalBagelsSold - previous.totalBagelsSold,
    bagelsSoldChangePercent:
      previous.totalBagelsSold > 0
        ? ((current.totalBagelsSold - previous.totalBagelsSold) /
            previous.totalBagelsSold) *
          100
        : 0,
    wasteRateChange: current.wasteRate - previous.wasteRate,
    storePercentChange: current.storePercent - previous.storePercent,
    uberPercentChange: current.uberPercent - previous.uberPercent,
    doordashPercentChange: current.doordashPercent - previous.doordashPercent,
  };
}

function buildSegmentResult(
  segmentName: string,
  segmentLabel: string,
  segmentRecords: RecordWithFactor[],
  baselineRecords: RecordWithFactor[],
  startDate: Date,
  endDate: Date
): SegmentResult {
  const segment = computePeriodSummary(segmentRecords, startDate, endDate);
  const baseline = computePeriodSummary(baselineRecords, startDate, endDate);

  return {
    segmentName,
    segmentLabel,
    segment,
    baseline,
    salesDiffPercent:
      baseline.averageDailySales > 0
        ? ((segment.averageDailySales - baseline.averageDailySales) /
            baseline.averageDailySales) *
          100
        : 0,
    bagelsSoldDiffPercent:
      baseline.averageBagelsSold > 0
        ? ((segment.averageBagelsSold - baseline.averageBagelsSold) /
            baseline.averageBagelsSold) *
          100
        : 0,
    wasteRateDiff: segment.wasteRate - baseline.wasteRate,
  };
}

export async function getHolidaySegmentComparison(
  startDate: Date,
  endDate: Date
): Promise<SegmentResult> {
  const records = await fetchRecordsInRange(startDate, endDate);

  const holidayRecords = records.filter(
    (r) => r.externalFactor?.holidayName != null && r.externalFactor.holidayName.length > 0
  );
  const nonHolidayRecords = records.filter(
    (r) => !(r.externalFactor?.holidayName != null && r.externalFactor.holidayName.length > 0)
  );

  return buildSegmentResult(
    "holiday",
    "Holiday",
    holidayRecords,
    nonHolidayRecords,
    startDate,
    endDate
  );
}

export async function getSchoolHolidaySegmentComparison(
  startDate: Date,
  endDate: Date
): Promise<SegmentResult> {
  const records = await fetchRecordsInRange(startDate, endDate);

  const schoolHolidayRecords = records.filter(
    (r) => r.externalFactor?.schoolHoliday === true
  );
  const regularRecords = records.filter(
    (r) => !(r.externalFactor?.schoolHoliday === true)
  );

  return buildSegmentResult(
    "schoolHoliday",
    "School Holiday",
    schoolHolidayRecords,
    regularRecords,
    startDate,
    endDate
  );
}

export async function getRainSegmentComparison(
  startDate: Date,
  endDate: Date
): Promise<SegmentResult> {
  const records = await fetchRecordsInRange(startDate, endDate);

  const rainyRecords = records.filter(
    (r) => (r.externalFactor?.rainMm ?? 0) > 0
  );
  const dryRecords = records.filter(
    (r) => !((r.externalFactor?.rainMm ?? 0) > 0)
  );

  return buildSegmentResult(
    "rain",
    "Rainy days",
    rainyRecords,
    dryRecords,
    startDate,
    endDate
  );
}

export async function getEventSegmentComparison(
  startDate: Date,
  endDate: Date
): Promise<SegmentResult> {
  const records = await fetchRecordsInRange(startDate, endDate);

  const eventRecords = records.filter(
    (r) => r.externalFactor?.localEventName != null && r.externalFactor.localEventName.length > 0
  );
  const regularRecords = records.filter(
    (r) =>
      !(r.externalFactor?.localEventName != null && r.externalFactor.localEventName.length > 0)
  );

  return buildSegmentResult(
    "event",
    "Local Event",
    eventRecords,
    regularRecords,
    startDate,
    endDate
  );
}

export async function getHolidayNameBreakdown(
  startDate: Date,
  endDate: Date
): Promise<HolidayBreakdown[]> {
  const records = await fetchRecordsInRange(startDate, endDate);

  const holidayMap = new Map<string, RecordWithFactor[]>();

  for (const r of records) {
    const name = r.externalFactor?.holidayName;
    if (!name) continue;
    if (!holidayMap.has(name)) holidayMap.set(name, []);
    holidayMap.get(name)!.push(r);
  }

  const result: HolidayBreakdown[] = [];
  for (const [holidayName, hrs] of holidayMap.entries()) {
    const totalSales = hrs.reduce((s, r) => s + recordTotalSales(r), 0);
    const totalBagelsSold = hrs.reduce((s, r) => s + (r.bagelsBaked - r.bagelsLeft), 0);
    const avgWasteRate =
      hrs.reduce((s, r) => s + safeDivide(r.bagelsLeft, r.bagelsBaked), 0) / hrs.length;

    result.push({
      holidayName,
      recordCount: hrs.length,
      avgSales: safeDivide(totalSales, hrs.length),
      avgBagelsSold: safeDivide(totalBagelsSold, hrs.length),
      avgWasteRate,
    });
  }

  return result.sort((a, b) => b.avgSales - a.avgSales);
}

const DOW_LABELS: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

/**
 * Aggregate daily records by day-of-week and return per-weekday metrics.
 * Also computes deviation vs the overall period average.
 *
 * Calculation basis:
 * - Uses the record's local date (stored as UTC midnight by Prisma).
 * - Day-of-week is derived with Date.getDay() on the UTC date value.
 * - totalSales = storeSales + uberSales + doordashSales + otherSales
 * - bagelsSold = bagelsBaked - bagelsLeft
 * - Results sorted Sunday → Saturday (0 → 6).
 */
export async function getDayOfWeekAnalytics(
  startDate: Date,
  endDate: Date
): Promise<DayOfWeekAnalyticsItem[]> {
  const records = await fetchRecordsInRange(startDate, endDate);
  if (records.length === 0) return [];

  // Group by day-of-week (UTC day, consistent with how dates are stored)
  const groups = new Map<number, RecordWithFactor[]>();
  for (const r of records) {
    const dow = new Date(r.date).getUTCDay();
    if (!groups.has(dow)) groups.set(dow, []);
    groups.get(dow)!.push(r);
  }

  // Overall period average for deviation calculation
  const overallTotalSales = records.reduce((s, r) => s + recordTotalSales(r), 0);
  const overallAvgSales = safeDivide(overallTotalSales, records.length);

  const result: DayOfWeekAnalyticsItem[] = [];

  for (let dow = 0; dow <= 6; dow++) {
    const dayRecords = groups.get(dow) ?? [];
    if (dayRecords.length === 0) {
      result.push({
        dayOfWeek: dow,
        dayLabel: DOW_LABELS[dow],
        recordCount: 0,
        totalSales: 0,
        avgSales: 0,
        totalBagelsSold: 0,
        avgBagelsSold: 0,
        avgWasteRate: 0,
        salesVsOverallAvgPercent: 0,
        isWeekend: dow === 0 || dow === 6,
      });
      continue;
    }

    const totalSales = dayRecords.reduce((s, r) => s + recordTotalSales(r), 0);
    const totalBagelsSold = dayRecords.reduce((s, r) => s + Math.max(0, r.bagelsBaked - r.bagelsLeft), 0);
    const avgWasteRate =
      dayRecords.reduce((s, r) => s + safeDivide(r.bagelsLeft, r.bagelsBaked), 0) /
      dayRecords.length;

    const avgSales = safeDivide(totalSales, dayRecords.length);

    result.push({
      dayOfWeek: dow,
      dayLabel: DOW_LABELS[dow],
      recordCount: dayRecords.length,
      totalSales,
      avgSales,
      totalBagelsSold,
      avgBagelsSold: safeDivide(totalBagelsSold, dayRecords.length),
      avgWasteRate,
      salesVsOverallAvgPercent:
        overallAvgSales > 0
          ? ((avgSales - overallAvgSales) / overallAvgSales) * 100
          : 0,
      isWeekend: dow === 0 || dow === 6,
    });
  }

  return result;
}
