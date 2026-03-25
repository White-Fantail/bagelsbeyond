import { prisma } from "@/lib/db";
import {
  safeNumber,
  roundSalesValue,
  roundBagelCount,
  getDayOfWeekKey,
  calculatePredictionConfidence,
  comparePredictedVsActual,
} from "@/lib/prediction-utils";
import type { DailyRecord, SalesPrediction } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExternalFactorInput = {
  weatherSummary?: string | null;
  minTemp?: number | null;
  maxTemp?: number | null;
  rainMm?: number | null;
  windKph?: number | null;
  holidayName?: string | null;
  localEventName?: string | null;
  schoolHoliday?: boolean;
  nzNewsSummary?: string | null;
  worldNewsSummary?: string | null;
};

export type PredictionInput = {
  targetDate: Date;
  recentRecords: DailyRecord[];
  sameDayRecords: DailyRecord[];
  weights: Record<string, number>;
  externalFactors: ExternalFactorInput;
};

export type FactorContribution = {
  factorKey: string;
  factorLabel: string;
  factorValue: string;
  appliedWeight: number;
  impactScore: number;
};

export type PredictionResult = {
  targetDate: Date;
  predictedSales: number;
  predictedBagelsSold: number;
  recommendedBagelsToBake: number;
  predictedLeftovers: number;
  confidenceScore: number;
  method: string;
  notes: string;
  factorContributions: FactorContribution[];
};

// ─── Input Builder ────────────────────────────────────────────────────────────

export async function buildPredictionInput(targetDate: Date): Promise<PredictionInput> {
  const LOOKBACK_DAYS = 30;
  const cutoff = new Date(targetDate);
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);

  const recentRecords = await prisma.dailyRecord.findMany({
    where: { date: { gte: cutoff, lt: targetDate } },
    orderBy: { date: "desc" },
    include: { externalFactor: true },
  }) as DailyRecord[];

  const targetDow = targetDate.getDay();
  const sameDayRecords = recentRecords.filter((r) => new Date(r.date).getDay() === targetDow);

  const weightRows = await prisma.predictionWeight.findMany({ where: { isActive: true } });
  const weights: Record<string, number> = {};
  for (const w of weightRows) {
    weights[w.factorKey] = w.weightValue;
  }

  // Check if external factor already saved for this date
  const existingRecord = await prisma.dailyRecord.findUnique({
    where: { date: targetDate },
    include: { externalFactor: true },
  });

  const externalFactors: ExternalFactorInput = existingRecord?.externalFactor ?? {};

  return { targetDate, recentRecords, sameDayRecords, weights, externalFactors };
}

// ─── Core Prediction Logic ─────────────────────────────────────────────────────

export function calculateRuleBasedPrediction(input: PredictionInput): PredictionResult {
  const { targetDate, recentRecords, sameDayRecords, weights, externalFactors } = input;
  const factors: FactorContribution[] = [];

  // ── Baseline: recent N-day average sales ──
  const getTotalSales = (r: DailyRecord) =>
    safeNumber(r.storeSales) + safeNumber(r.uberSales) + safeNumber(r.doordashSales) + safeNumber(r.otherSales);
  const getSold = (r: DailyRecord) => safeNumber(r.bagelsBaked) - safeNumber(r.bagelsLeft);

  const baseline =
    recentRecords.length > 0
      ? recentRecords.reduce((s, r) => s + getTotalSales(r), 0) / recentRecords.length
      : 300; // Fallback when no data

  const baselineBagels =
    recentRecords.length > 0
      ? recentRecords.reduce((s, r) => s + getSold(r), 0) / recentRecords.length
      : 60;

  // ── Same weekday adjustment ──
  let dowAdjustedSales = baseline;
  let dowAdjustedBagels = baselineBagels;

  if (sameDayRecords.length > 0) {
    const sameDayAvgSales =
      sameDayRecords.reduce((s, r) => s + getTotalSales(r), 0) / sameDayRecords.length;
    const sameDayAvgBagels =
      sameDayRecords.reduce((s, r) => s + getSold(r), 0) / sameDayRecords.length;
    // Blend 50/50 between overall average and same-day average
    dowAdjustedSales = (baseline + sameDayAvgSales) / 2;
    dowAdjustedBagels = (baselineBagels + sameDayAvgBagels) / 2;
  }

  // ── Apply day-of-week weight ──
  const dowKey = getDayOfWeekKey(targetDate);
  const dowWeight = safeNumber(weights[dowKey], 0);
  const dowImpact = dowAdjustedSales * dowWeight;
  factors.push({
    factorKey: dowKey,
    factorLabel: `요일 (${dowKey})`,
    factorValue: "true",
    appliedWeight: dowWeight,
    impactScore: roundSalesValue(dowImpact),
  });

  let adjustedSales = dowAdjustedSales + dowImpact;
  let adjustedBagels = dowAdjustedBagels * (1 + dowWeight);

  // ── Rain weight ──
  const rainMm = safeNumber(externalFactors.rainMm, 0);
  if (rainMm > 0) {
    const rainWeight = safeNumber(weights["weather_rain"], -0.15);
    const rainImpact = adjustedSales * rainWeight;
    factors.push({
      factorKey: "weather_rain",
      factorLabel: "비 (강수량)",
      factorValue: `${rainMm}mm`,
      appliedWeight: rainWeight,
      impactScore: roundSalesValue(rainImpact),
    });
    adjustedSales += rainImpact;
    adjustedBagels *= 1 + rainWeight;
  }

  // ── Hot weather weight ──
  const maxTemp = safeNumber(externalFactors.maxTemp, 0);
  if (maxTemp > 28) {
    const hotWeight = safeNumber(weights["weather_hot"], -0.05);
    const hotImpact = adjustedSales * hotWeight;
    factors.push({
      factorKey: "weather_hot",
      factorLabel: "더위 (기온)",
      factorValue: `${maxTemp}°C`,
      appliedWeight: hotWeight,
      impactScore: roundSalesValue(hotImpact),
    });
    adjustedSales += hotImpact;
    adjustedBagels *= 1 + hotWeight;
  }

  // ── Holiday weight ──
  if (externalFactors.holidayName) {
    const holidayWeight = safeNumber(weights["holiday"], 0.3);
    const holidayImpact = adjustedSales * holidayWeight;
    factors.push({
      factorKey: "holiday",
      factorLabel: "공휴일",
      factorValue: externalFactors.holidayName,
      appliedWeight: holidayWeight,
      impactScore: roundSalesValue(holidayImpact),
    });
    adjustedSales += holidayImpact;
    adjustedBagels *= 1 + holidayWeight;
  }

  // ── Local event weight ──
  if (externalFactors.localEventName) {
    const eventWeight = safeNumber(weights["local_event"], 0.2);
    const eventImpact = adjustedSales * eventWeight;
    factors.push({
      factorKey: "local_event",
      factorLabel: "지역 이벤트",
      factorValue: externalFactors.localEventName,
      appliedWeight: eventWeight,
      impactScore: roundSalesValue(eventImpact),
    });
    adjustedSales += eventImpact;
    adjustedBagels *= 1 + eventWeight;
  }

  // ── School holiday weight ──
  if (externalFactors.schoolHoliday) {
    const schoolWeight = safeNumber(weights["school_holiday"], 0.1);
    const schoolImpact = adjustedSales * schoolWeight;
    factors.push({
      factorKey: "school_holiday",
      factorLabel: "학교 방학",
      factorValue: "true",
      appliedWeight: schoolWeight,
      impactScore: roundSalesValue(schoolImpact),
    });
    adjustedSales += schoolImpact;
    adjustedBagels *= 1 + schoolWeight;
  }

  // ── Ensure non-negative ──
  const predictedSales = roundSalesValue(Math.max(0, adjustedSales));
  const predictedBagelsSold = roundBagelCount(Math.max(0, adjustedBagels));

  // ── Recommended production: sold + safety buffer ──
  const avgLeftoverRate =
    recentRecords.length > 0
      ? recentRecords.reduce((s, r) => s + safeNumber(r.bagelsLeft) / Math.max(1, safeNumber(r.bagelsBaked)), 0) /
        recentRecords.length
      : 0.05;
  const safetyBuffer = 1 + Math.max(0.05, avgLeftoverRate);
  const recommendedBagelsToBake = roundBagelCount(predictedBagelsSold * safetyBuffer);
  const predictedLeftovers = Math.max(0, recommendedBagelsToBake - predictedBagelsSold);

  // ── Confidence ──
  const factorCompleteness =
    [
      externalFactors.weatherSummary,
      externalFactors.rainMm !== undefined && externalFactors.rainMm !== null,
      externalFactors.maxTemp !== undefined && externalFactors.maxTemp !== null,
      externalFactors.holidayName !== undefined,
    ].filter(Boolean).length / 4;

  const confidenceScore = calculatePredictionConfidence({
    dataPointCount: recentRecords.length,
    factorCompleteness,
    hasWeekdayData: sameDayRecords.length > 0,
  });

  const noteParts = [
    `기준 데이터: 최근 ${recentRecords.length}일`,
    sameDayRecords.length > 0 ? `같은 요일 ${sameDayRecords.length}건 참고` : null,
    `적용 요인: ${factors.length}개`,
  ].filter(Boolean);

  return {
    targetDate,
    predictedSales,
    predictedBagelsSold,
    recommendedBagelsToBake,
    predictedLeftovers,
    confidenceScore,
    method: "rule_based_v1",
    notes: noteParts.join(" | "),
    factorContributions: factors,
  };
}

// ─── Save Result ───────────────────────────────────────────────────────────────

export async function savePredictionResult(result: PredictionResult): Promise<SalesPrediction> {
  // Upsert: if prediction for targetDate exists, delete and recreate (to refresh snapshots)
  const existing = await prisma.salesPrediction.findFirst({
    where: { targetDate: result.targetDate },
  });

  if (existing) {
    await prisma.salesPrediction.delete({ where: { id: existing.id } });
  }

  const saved = await prisma.salesPrediction.create({
    data: {
      targetDate: result.targetDate,
      predictedSales: result.predictedSales,
      predictedBagelsSold: result.predictedBagelsSold,
      recommendedBagelsToBake: result.recommendedBagelsToBake,
      predictedLeftovers: result.predictedLeftovers,
      confidenceScore: result.confidenceScore,
      method: result.method,
      notes: result.notes,
      factorSnapshots: {
        create: result.factorContributions.map((f) => ({
          factorKey: f.factorKey,
          factorLabel: f.factorLabel,
          factorValue: f.factorValue,
          appliedWeight: f.appliedWeight,
          impactScore: f.impactScore,
        })),
      },
    },
    include: { factorSnapshots: true },
  });

  return saved as SalesPrediction;
}

// ─── Queries ───────────────────────────────────────────────────────────────────

export async function getPredictionByDate(date: Date): Promise<SalesPrediction | null> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const result = await prisma.salesPrediction.findFirst({
    where: { targetDate: { gte: start, lte: end } },
    include: { factorSnapshots: true },
    orderBy: { createdAt: "desc" },
  });

  return result as SalesPrediction | null;
}

export async function comparePredictionWithActual(date: Date) {
  const prediction = await getPredictionByDate(date);
  if (!prediction) return null;

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const actual = await prisma.dailyRecord.findFirst({
    where: { date: { gte: start, lte: end } },
  }) as DailyRecord | null;

  if (!actual) return { prediction, actual: null, comparison: null };

  const comparison = comparePredictedVsActual(prediction, actual);
  return { prediction, actual, comparison };
}
