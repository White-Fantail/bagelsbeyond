import { prisma } from "@/lib/db";
import {
  safeNumber,
  roundSalesValue,
  roundBagelCount,
  getDayOfWeekKey,
  getDayOfWeekLabel,
  calculatePredictionConfidence,
  comparePredictedVsActual,
} from "@/lib/prediction-utils";
import type { DailyRecord, SalesPrediction, PredictionExplanation, PredictionExplanationItem } from "@/types";

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

export type AppSettingInput = {
  defaultTargetWasteRatio: number;
  defaultSafetyBuffer: number;
  predictionLookbackDays: number;
};

export type PredictionInput = {
  targetDate: Date;
  recentRecords: DailyRecord[];
  sameDayRecords: DailyRecord[];
  weights: Record<string, number>;
  externalFactors: ExternalFactorInput;
  settings: AppSettingInput;
};

export type BaselineMetrics = {
  avgSales: number;
  avgBagelsSold: number;
  sameDayAvgSales: number;
  sameDayAvgBagels: number;
  blendedAvgSales: number;
  blendedAvgBagels: number;
  avgWasteRate: number;
  avgSoldToBakedRatio: number;
  dataPointCount: number;
  sameDayDataPointCount: number;
};

export type FactorContribution = {
  factorKey: string;
  factorLabel: string;
  factorValue: string;
  appliedWeight: number;
  impactScore: number;
};

export type ProductionRecommendation = {
  recommendedBagelsToBake: number;
  predictedLeftovers: number;
  projectedWasteRate: number;
  projectedSellThroughRate: number;
};

export type PredictionResult = {
  targetDate: Date;
  predictedSales: number;
  predictedBagelsSold: number;
  recommendedBagelsToBake: number;
  predictedLeftovers: number;
  projectedWasteRate: number;
  projectedSellThroughRate: number;
  baselineSales: number;
  baselineBagelsSold: number;
  confidenceScore: number;
  method: string;
  notes: string;
  adjustmentSummary: string;
  explanationJson: string;
  factorContributions: FactorContribution[];
};

// ─── Recency Weighting ────────────────────────────────────────────────────────

// Tiered recency weights: last 30 days get full weight, the prior 90 days
// (days 31–120) get medium weight, and anything older gets low weight.
// This gives meaningful importance to recent history without over-indexing on
// a single day.
function computeRecencyWeight(targetDate: Date, recordDate: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysAgo = Math.max(0, (targetDate.getTime() - new Date(recordDate).getTime()) / msPerDay);
  if (daysAgo <= 30) return 1.0;
  if (daysAgo <= 120) return 0.4;
  return 0.1;
}

// ─── Input Builder ────────────────────────────────────────────────────────────

export async function buildPredictionInput(targetDate: Date): Promise<PredictionInput> {
  const settingsRow = await prisma.appSetting.findFirst();
  const settings: AppSettingInput = {
    defaultTargetWasteRatio: safeNumber(settingsRow?.defaultTargetWasteRatio, 0.05),
    defaultSafetyBuffer: safeNumber(settingsRow?.defaultSafetyBuffer, 1.1),
    predictionLookbackDays: safeNumber(settingsRow?.predictionLookbackDays, 365),
  };

  const lookbackCutoff = new Date(targetDate);
  lookbackCutoff.setDate(lookbackCutoff.getDate() - settings.predictionLookbackDays);

  const recentRecords = await prisma.dailyRecord.findMany({
    where: { date: { gte: lookbackCutoff, lt: targetDate } },
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

  // Build a date range for the target date (midnight to midnight UTC)
  const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);

  // 1. Try to get external factors via DailyRecord relation (actual sales day)
  const existingRecord = await prisma.dailyRecord.findFirst({
    where: { date: { gte: dayStart, lt: dayEnd } },
    include: { externalFactor: true },
  });

  let externalFactors: ExternalFactorInput = {};

  if (existingRecord?.externalFactor) {
    // Use factors from the linked DailyRecord
    externalFactors = existingRecord.externalFactor;
    console.log(`[prediction] External factors loaded from DailyRecord relation for ${targetDate.toISOString().split("T")[0]}`);
  } else {
    // 2. Fallback: look for a standalone DailyExternalFactor by date
    //    (created by ensureExternalFactorsForPredictionDate before we get here)
    const standaloneFactors = await prisma.dailyExternalFactor.findFirst({
      where: { date: { gte: dayStart, lt: dayEnd } },
    });
    if (standaloneFactors) {
      externalFactors = standaloneFactors;
      console.log(`[prediction] External factors loaded from standalone DailyExternalFactor for ${targetDate.toISOString().split("T")[0]}`);
    } else {
      console.warn(`[prediction] No external factors found for ${targetDate.toISOString().split("T")[0]} — prediction will use default values`);
    }
  }

  return { targetDate, recentRecords, sameDayRecords, weights, externalFactors, settings };
}

// ─── Baseline Metrics ─────────────────────────────────────────────────────────

export function calculateBaselineMetrics(input: PredictionInput): BaselineMetrics {
  const { targetDate, recentRecords, sameDayRecords } = input;

  const getTotalSales = (r: DailyRecord) =>
    safeNumber(r.storeSales) + safeNumber(r.uberSales) + safeNumber(r.doordashSales) + safeNumber(r.otherSales);
  const getSold = (r: DailyRecord) => Math.max(0, safeNumber(r.bagelsBaked) - safeNumber(r.bagelsLeft));

  // Recency weights for all records — recent records contribute more to the baseline
  const recencyWeights = recentRecords.map((r) => computeRecencyWeight(targetDate, r.date));
  const totalRecencyWeight = recencyWeights.reduce((s, w) => s + w, 0);

  const avgSales =
    recentRecords.length > 0 && totalRecencyWeight > 0
      ? recentRecords.reduce((s, r, i) => s + getTotalSales(r) * recencyWeights[i], 0) / totalRecencyWeight
      : 300;

  const avgBagelsSold =
    recentRecords.length > 0 && totalRecencyWeight > 0
      ? recentRecords.reduce((s, r, i) => s + getSold(r) * recencyWeights[i], 0) / totalRecencyWeight
      : 60;

  // Same-day recency weights (same weekday historical records)
  const sameDayRecencyWeights = sameDayRecords.map((r) => computeRecencyWeight(targetDate, r.date));
  const totalSameDayWeight = sameDayRecencyWeights.reduce((s, w) => s + w, 0);

  const sameDayAvgSales =
    sameDayRecords.length > 0 && totalSameDayWeight > 0
      ? sameDayRecords.reduce((s, r, i) => s + getTotalSales(r) * sameDayRecencyWeights[i], 0) / totalSameDayWeight
      : avgSales;

  const sameDayAvgBagels =
    sameDayRecords.length > 0 && totalSameDayWeight > 0
      ? sameDayRecords.reduce((s, r, i) => s + getSold(r) * sameDayRecencyWeights[i], 0) / totalSameDayWeight
      : avgBagelsSold;

  // Blend: weight same-day data more when available
  const sameDayBlendWeight = sameDayRecords.length > 0 ? 0.6 : 0;
  const overallBlendWeight = 1 - sameDayBlendWeight;
  const blendedAvgSales = sameDayBlendWeight * sameDayAvgSales + overallBlendWeight * avgSales;
  const blendedAvgBagels = sameDayBlendWeight * sameDayAvgBagels + overallBlendWeight * avgBagelsSold;

  // Waste rate: bagelsLeft / bagelsBaked — recency-weighted, skip zero-baked records
  const validWasteRecords = recentRecords.filter((r) => safeNumber(r.bagelsBaked) > 0);
  const validWasteWeights = validWasteRecords.map((r) => computeRecencyWeight(targetDate, r.date));
  const totalValidWasteWeight = validWasteWeights.reduce((s, w) => s + w, 0);

  const avgWasteRate =
    validWasteRecords.length > 0 && totalValidWasteWeight > 0
      ? validWasteRecords.reduce((s, r, i) => s + (safeNumber(r.bagelsLeft) / safeNumber(r.bagelsBaked)) * validWasteWeights[i], 0) / totalValidWasteWeight
      : 0.05;

  // sold/baked ratio — recency-weighted, skip zero-baked records
  const avgSoldToBakedRatio =
    validWasteRecords.length > 0 && totalValidWasteWeight > 0
      ? validWasteRecords.reduce((s, r, i) => {
          const sold = getSold(r);
          return s + (sold / safeNumber(r.bagelsBaked)) * validWasteWeights[i];
        }, 0) / totalValidWasteWeight
      : 0.95;

  return {
    avgSales,
    avgBagelsSold,
    sameDayAvgSales,
    sameDayAvgBagels,
    blendedAvgSales,
    blendedAvgBagels,
    avgWasteRate,
    avgSoldToBakedRatio,
    dataPointCount: recentRecords.length,
    sameDayDataPointCount: sameDayRecords.length,
  };
}

// ─── External Factor Adjustments ──────────────────────────────────────────────

export function applyExternalFactorAdjustments(
  baseSales: number,
  baseBagels: number,
  input: PredictionInput
): { adjustedSales: number; adjustedBagels: number; factors: FactorContribution[]; adjustmentTexts: string[] } {
  const { targetDate, weights, externalFactors } = input;
  const factors: FactorContribution[] = [];
  const adjustmentTexts: string[] = [];

  let adjustedSales = baseSales;
  let adjustedBagels = baseBagels;

  // Day of week
  const dowKey = getDayOfWeekKey(targetDate);
  const dowLabel = getDayOfWeekLabel(targetDate);
  const dowWeight = safeNumber(weights[dowKey], 0);
  if (dowWeight !== 0) {
    const dowImpact = roundSalesValue(adjustedSales * dowWeight);
    factors.push({
      factorKey: dowKey,
      factorLabel: `Day (${dowLabel})`,
      factorValue: dowLabel,
      appliedWeight: dowWeight,
      impactScore: dowImpact,
    });
    adjustedSales += dowImpact;
    adjustedBagels *= 1 + dowWeight;
    if (dowWeight > 0) {
      adjustmentTexts.push(`${dowLabel} is above average, adjusted up (+${(dowWeight * 100).toFixed(0)}%)`);
    } else {
      adjustmentTexts.push(`${dowLabel} is below average, adjusted down (${(dowWeight * 100).toFixed(0)}%)`);
    }
  }

  // Rain
  const rainMm = safeNumber(externalFactors.rainMm, 0);
  if (rainMm > 0) {
    const rainWeight = safeNumber(weights["weather_rain"], -0.15);
    const rainImpact = roundSalesValue(adjustedSales * rainWeight);
    factors.push({
      factorKey: "weather_rain",
      factorLabel: "Rain (Rainfall)",
      factorValue: `${rainMm.toFixed(1)}mm`,
      appliedWeight: rainWeight,
      impactScore: rainImpact,
    });
    adjustedSales += rainImpact;
    adjustedBagels *= 1 + rainWeight;
    adjustmentTexts.push(`Rain forecast (${rainMm.toFixed(1)}mm) — Sales adjusted down (${(rainWeight * 100).toFixed(0)}%)`);
  }

  // Hot weather
  const maxTemp = safeNumber(externalFactors.maxTemp, 0);
  if (maxTemp > 28) {
    const hotWeight = safeNumber(weights["weather_hot"], -0.05);
    const hotImpact = roundSalesValue(adjustedSales * hotWeight);
    factors.push({
      factorKey: "weather_hot",
      factorLabel: "Heat (temperature)",
      factorValue: `${maxTemp.toFixed(1)}°C`,
      appliedWeight: hotWeight,
      impactScore: hotImpact,
    });
    adjustedSales += hotImpact;
    adjustedBagels *= 1 + hotWeight;
    adjustmentTexts.push(`High temperature (${maxTemp.toFixed(1)}°C) — Sales slightly adjusted down`);
  }

  // Holiday
  if (externalFactors.holidayName) {
    const holidayWeight = safeNumber(weights["holiday"], 0.3);
    const holidayImpact = roundSalesValue(adjustedSales * holidayWeight);
    factors.push({
      factorKey: "holiday",
      factorLabel: "Holiday",
      factorValue: externalFactors.holidayName,
      appliedWeight: holidayWeight,
      impactScore: holidayImpact,
    });
    adjustedSales += holidayImpact;
    adjustedBagels *= 1 + holidayWeight;
    adjustmentTexts.push(`Holiday (${externalFactors.holidayName}) Effect — Sold qty adjusted up (+${(holidayWeight * 100).toFixed(0)}%)`);
  }

  // Local event
  if (externalFactors.localEventName) {
    const eventWeight = safeNumber(weights["local_event"], 0.2);
    const eventImpact = roundSalesValue(adjustedSales * eventWeight);
    factors.push({
      factorKey: "local_event",
      factorLabel: "Local Event",
      factorValue: externalFactors.localEventName,
      appliedWeight: eventWeight,
      impactScore: eventImpact,
    });
    adjustedSales += eventImpact;
    adjustedBagels *= 1 + eventWeight;
    adjustmentTexts.push(`Local Event (${externalFactors.localEventName}) Effect — Sales adjusted up`);
  }

  // School holiday
  if (externalFactors.schoolHoliday) {
    const schoolWeight = safeNumber(weights["school_holiday"], 0.1);
    const schoolImpact = roundSalesValue(adjustedSales * schoolWeight);
    factors.push({
      factorKey: "school_holiday",
      factorLabel: "School Holiday",
      factorValue: "During School Holiday",
      appliedWeight: schoolWeight,
      impactScore: schoolImpact,
    });
    adjustedSales += schoolImpact;
    adjustedBagels *= 1 + schoolWeight;
    adjustmentTexts.push(`School Holiday Period — family customer demand increase reflected (+${(schoolWeight * 100).toFixed(0)}%)`);
  }

  // News impact
  const hasNegativeNzNews = externalFactors.nzNewsSummary && externalFactors.nzNewsSummary.length > 10;
  if (hasNegativeNzNews) {
    const newsWeight = safeNumber(weights["nz_news"], -0.05);
    if (newsWeight < 0) {
      const newsImpact = roundSalesValue(adjustedSales * newsWeight);
      factors.push({
        factorKey: "nz_news",
        factorLabel: "NZ News",
        factorValue: "negative News impact",
        appliedWeight: newsWeight,
        impactScore: newsImpact,
      });
      adjustedSales += newsImpact;
      adjustedBagels *= 1 + newsWeight;
      adjustmentTexts.push(`News impact slightly reduced sales`);
    }
  }

  return {
    adjustedSales: Math.max(0, adjustedSales),
    adjustedBagels: Math.max(0, adjustedBagels),
    factors,
    adjustmentTexts,
  };
}

// ─── Production Recommendation ────────────────────────────────────────────────

export function calculateRecommendedProduction(
  predictedBagelsSold: number,
  settings: AppSettingInput,
  metrics: BaselineMetrics,
  hasSpecialEvent: boolean
): ProductionRecommendation {
  const { defaultSafetyBuffer, defaultTargetWasteRatio } = settings;
  const { avgWasteRate, avgSoldToBakedRatio } = metrics;

  // Base: use historical sold/baked ratio if available, otherwise use safety buffer
  let buffer: number;
  if (avgSoldToBakedRatio > 0 && avgSoldToBakedRatio < 1) {
    // Historical: if sold 95% of baked, we bake predicted / 0.95
    buffer = 1 / avgSoldToBakedRatio;
  } else {
    buffer = defaultSafetyBuffer;
  }

  // Clamp buffer to reasonable range [1.02, 1.4]
  buffer = Math.max(1.02, Math.min(1.4, buffer));

  // If special event, add extra 5%
  if (hasSpecialEvent) {
    buffer = Math.min(1.45, buffer + 0.05);
  }

  // Target waste: if recent waste is higher than target, reduce buffer slightly
  const targetWasteRatio = defaultTargetWasteRatio;
  if (avgWasteRate > targetWasteRatio * 2) {
    // We've been wasting a lot; reduce buffer
    buffer = Math.max(1.02, buffer - 0.05);
  }

  const raw = predictedBagelsSold * buffer;
  const recommendedBagelsToBake = roundBagelCount(raw);
  const predictedLeftovers = Math.max(0, recommendedBagelsToBake - predictedBagelsSold);

  const projectedWasteRate =
    recommendedBagelsToBake > 0 ? predictedLeftovers / recommendedBagelsToBake : 0;
  const projectedSellThroughRate = 1 - projectedWasteRate;

  return {
    recommendedBagelsToBake,
    predictedLeftovers,
    projectedWasteRate: roundSalesValue(projectedWasteRate),
    projectedSellThroughRate: roundSalesValue(projectedSellThroughRate),
  };
}

// ─── Explanation Builder ──────────────────────────────────────────────────────

export function buildPredictionExplanation(
  input: PredictionInput,
  metrics: BaselineMetrics,
  adjustmentTexts: string[],
  production: ProductionRecommendation,
  predictedSales: number,
  predictedBagelsSold: number
): PredictionExplanation {
  const items: PredictionExplanationItem[] = [];

  // Baseline info
  if (metrics.dataPointCount === 0) {
    items.push({ type: "info", text: "Insufficient data — using default value." });
  } else {
    items.push({
      type: "baseline",
      text: `Recency-weighted avg. sales ($${Math.round(metrics.avgSales).toLocaleString("en-NZ")}) from ${metrics.dataPointCount} historical records (recent data weighted higher)`,
    });
  }

  if (metrics.sameDayDataPointCount > 0) {
    const diff = metrics.sameDayAvgSales - metrics.avgSales;
    const direction = diff >= 0 ? "above, adjusted up" : "below, adjusted down";
    items.push({
      type: "weekday",
      text: `Same-day average is $${Math.abs(diff).toFixed(0)} ${direction} vs. overall average (${metrics.sameDayDataPointCount} data points)`,
    });
  }

  // Adjustments
  for (const text of adjustmentTexts) {
    const type = text.includes("Rain") || text.includes("temperature") ? "weather"
      : text.includes("Holiday") ? "holiday"
      : text.includes("Event") ? "event"
      : text.includes("School Holiday") ? "school"
      : text.includes("News") ? "news"
      : "weekday";
    items.push({ type, text });
  }

  // Production recommendation
  const bufferPct = Math.round((production.recommendedBagelsToBake / Math.max(1, predictedBagelsSold) - 1) * 100);
  items.push({
    type: "production",
    text: `${bufferPct}% buffer over estimated sold qty based on Waste Rate (${(metrics.avgWasteRate * 100).toFixed(1)}%)`,
  });

  items.push({
    type: "production",
    text: `Recommended Production: ${production.recommendedBagelsToBake} (Predicted Remaining: ${production.predictedLeftovers}, Estimated Sell-through Rate: ${(production.projectedSellThroughRate * 100).toFixed(1)}%)`,
  });

  const summary =
    `Predicted Sales ${Math.round(predictedSales).toLocaleString("en-NZ")}, ` +
    `Based on Sold: ${predictedBagelsSold} baseline — ` +
    `Recommended production: ${production.recommendedBagelsToBake}.`;

  return { items, summary };
}

// ─── Core Prediction Logic ─────────────────────────────────────────────────────

export function calculateRuleBasedPrediction(input: PredictionInput): PredictionResult {
  const { targetDate, externalFactors, settings } = input;

  // Step 1: Baseline
  const metrics = calculateBaselineMetrics(input);

  // Step 2: Apply external factor adjustments
  const { adjustedSales, adjustedBagels, factors, adjustmentTexts } = applyExternalFactorAdjustments(
    metrics.blendedAvgSales,
    metrics.blendedAvgBagels,
    input
  );

  const predictedSales = roundSalesValue(Math.max(0, adjustedSales));
  const predictedBagelsSold = roundBagelCount(Math.max(0, adjustedBagels));

  // Step 3: Production recommendation
  const hasSpecialEvent = !!(externalFactors.holidayName || externalFactors.localEventName);
  const production = calculateRecommendedProduction(predictedBagelsSold, settings, metrics, hasSpecialEvent);

  // Step 4: Confidence
  const factorCompleteness =
    [
      externalFactors.weatherSummary,
      externalFactors.rainMm !== undefined && externalFactors.rainMm !== null,
      externalFactors.maxTemp !== undefined && externalFactors.maxTemp !== null,
      externalFactors.holidayName !== undefined,
    ].filter(Boolean).length / 4;

  const confidenceScore = calculatePredictionConfidence({
    dataPointCount: metrics.dataPointCount,
    factorCompleteness,
    hasWeekdayData: metrics.sameDayDataPointCount > 0,
  });

  // Step 5: Explanation
  const explanation = buildPredictionExplanation(
    input,
    metrics,
    adjustmentTexts,
    production,
    predictedSales,
    predictedBagelsSold
  );

  const adjustmentSummary = adjustmentTexts.length > 0
    ? adjustmentTexts.join("; ")
    : "No adjustment added";

  const noteParts = [
    `baseline Data: ${metrics.dataPointCount} records (recency-weighted)`,
    metrics.sameDayDataPointCount > 0 ? `same-day ${metrics.sameDayDataPointCount} data points` : null,
    `Applied Factor: ${factors.length}`,
  ].filter(Boolean);

  return {
    targetDate,
    predictedSales,
    predictedBagelsSold,
    recommendedBagelsToBake: production.recommendedBagelsToBake,
    predictedLeftovers: production.predictedLeftovers,
    projectedWasteRate: production.projectedWasteRate,
    projectedSellThroughRate: production.projectedSellThroughRate,
    baselineSales: roundSalesValue(metrics.blendedAvgSales),
    baselineBagelsSold: roundBagelCount(metrics.blendedAvgBagels),
    confidenceScore,
    method: "rule_based_v3",
    notes: noteParts.join(" | "),
    adjustmentSummary,
    explanationJson: JSON.stringify(explanation),
    factorContributions: factors,
  };
}

// ─── Save Result ───────────────────────────────────────────────────────────────

export async function savePredictionResult(result: PredictionResult): Promise<SalesPrediction> {
  // Use a full-day range to catch any timezone-shifted duplicates
  const dayStart = new Date(result.targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(result.targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  const existingList = await prisma.salesPrediction.findMany({
    where: { targetDate: { gte: dayStart, lte: dayEnd } },
    select: { id: true },
  });

  if (existingList.length > 0) {
    await prisma.salesPrediction.deleteMany({
      where: { id: { in: existingList.map((e: { id: string }) => e.id) } },
    });
  }

  const saved = await prisma.salesPrediction.create({
    data: {
      targetDate: result.targetDate,
      predictedSales: result.predictedSales,
      predictedBagelsSold: result.predictedBagelsSold,
      recommendedBagelsToBake: result.recommendedBagelsToBake,
      predictedLeftovers: result.predictedLeftovers,
      projectedWasteRate: result.projectedWasteRate,
      projectedSellThroughRate: result.projectedSellThroughRate,
      baselineSales: result.baselineSales,
      baselineBagelsSold: result.baselineBagelsSold,
      confidenceScore: result.confidenceScore,
      method: result.method,
      notes: result.notes,
      adjustmentSummary: result.adjustmentSummary,
      explanationJson: result.explanationJson,
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

// ─── Performance Stats ─────────────────────────────────────────────────────────

export async function getPredictionPerformanceStats() {
  const predictions = await prisma.salesPrediction.findMany({
    orderBy: { targetDate: "desc" },
    take: 30,
  }) as SalesPrediction[];

  const comparisons = await Promise.all(
    predictions.map(async (pred) => {
      const start = new Date(pred.targetDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(pred.targetDate);
      end.setHours(23, 59, 59, 999);

      const actual = await prisma.dailyRecord.findFirst({
        where: { date: { gte: start, lte: end } },
      }) as DailyRecord | null;

      if (!actual) return { prediction: pred, actual: null, comparison: null };
      const comparison = comparePredictedVsActual(pred, actual);
      return { prediction: pred, actual, comparison };
    })
  );

  const comparable = comparisons.filter((c) => c.comparison !== null);

  const avgSalesError =
    comparable.length > 0
      ? comparable.reduce((s, c) => s + c.comparison!.salesErrorAbs, 0) / comparable.length
      : 0;

  const avgBagelsError =
    comparable.length > 0
      ? comparable.reduce((s, c) => s + c.comparison!.bagelsErrorAbs, 0) / comparable.length
      : 0;

  const avgSalesErrorPct =
    comparable.length > 0
      ? comparable.reduce((s, c) => s + Math.abs(c.comparison!.salesErrorPct), 0) / comparable.length
      : 0;

  const accurateCount = comparable.filter((c) => c.comparison!.direction === "accurate").length;

  return {
    total: predictions.length,
    comparableCount: comparable.length,
    avgSalesError: roundSalesValue(avgSalesError),
    avgBagelsError: Math.round(avgBagelsError * 10) / 10,
    avgSalesErrorPct: roundSalesValue(avgSalesErrorPct),
    accurateCount,
    accuracyRate: comparable.length > 0 ? Math.round((accurateCount / comparable.length) * 100) : 0,
    comparisons,
  };
}
