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

  const settingsRow = await prisma.appSetting.findFirst();
  const settings: AppSettingInput = {
    defaultTargetWasteRatio: safeNumber(settingsRow?.defaultTargetWasteRatio, 0.05),
    defaultSafetyBuffer: safeNumber(settingsRow?.defaultSafetyBuffer, 1.1),
  };

  return { targetDate, recentRecords, sameDayRecords, weights, externalFactors, settings };
}

// ─── Baseline Metrics ─────────────────────────────────────────────────────────

export function calculateBaselineMetrics(input: PredictionInput): BaselineMetrics {
  const { recentRecords, sameDayRecords } = input;

  const getTotalSales = (r: DailyRecord) =>
    safeNumber(r.storeSales) + safeNumber(r.uberSales) + safeNumber(r.doordashSales) + safeNumber(r.otherSales);
  const getSold = (r: DailyRecord) => Math.max(0, safeNumber(r.bagelsBaked) - safeNumber(r.bagelsLeft));

  const avgSales =
    recentRecords.length > 0
      ? recentRecords.reduce((s, r) => s + getTotalSales(r), 0) / recentRecords.length
      : 300;

  const avgBagelsSold =
    recentRecords.length > 0
      ? recentRecords.reduce((s, r) => s + getSold(r), 0) / recentRecords.length
      : 60;

  const sameDayAvgSales =
    sameDayRecords.length > 0
      ? sameDayRecords.reduce((s, r) => s + getTotalSales(r), 0) / sameDayRecords.length
      : avgSales;

  const sameDayAvgBagels =
    sameDayRecords.length > 0
      ? sameDayRecords.reduce((s, r) => s + getSold(r), 0) / sameDayRecords.length
      : avgBagelsSold;

  // Blend: weight same-day data more when available
  const sameDayWeight = sameDayRecords.length > 0 ? 0.6 : 0;
  const overallWeight = 1 - sameDayWeight;
  const blendedAvgSales = sameDayWeight * sameDayAvgSales + overallWeight * avgSales;
  const blendedAvgBagels = sameDayWeight * sameDayAvgBagels + overallWeight * avgBagelsSold;

  // Waste rate: bagelsLeft / bagelsBaked (skip records with invalid/zero baked count)
  const validWasteRecords = recentRecords.filter((r) => safeNumber(r.bagelsBaked) > 0);
  const avgWasteRate =
    validWasteRecords.length > 0
      ? validWasteRecords.reduce((s, r) => s + safeNumber(r.bagelsLeft) / safeNumber(r.bagelsBaked), 0) / validWasteRecords.length
      : 0.05;

  // sold/baked ratio (skip records with invalid/zero baked count)
  const avgSoldToBakedRatio =
    validWasteRecords.length > 0
      ? validWasteRecords.reduce((s, r) => {
          const sold = getSold(r);
          return s + sold / safeNumber(r.bagelsBaked);
        }, 0) / validWasteRecords.length
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
      factorLabel: `요일 (${dowLabel})`,
      factorValue: dowLabel,
      appliedWeight: dowWeight,
      impactScore: dowImpact,
    });
    adjustedSales += dowImpact;
    adjustedBagels *= 1 + dowWeight;
    if (dowWeight > 0) {
      adjustmentTexts.push(`${dowLabel}은 평균보다 매출이 높은 요일로 상향 반영됨 (+${(dowWeight * 100).toFixed(0)}%)`);
    } else {
      adjustmentTexts.push(`${dowLabel}은 평균보다 매출이 낮은 요일로 하향 반영됨 (${(dowWeight * 100).toFixed(0)}%)`);
    }
  }

  // Rain
  const rainMm = safeNumber(externalFactors.rainMm, 0);
  if (rainMm > 0) {
    const rainWeight = safeNumber(weights["weather_rain"], -0.15);
    const rainImpact = roundSalesValue(adjustedSales * rainWeight);
    factors.push({
      factorKey: "weather_rain",
      factorLabel: "비 (강수량)",
      factorValue: `${rainMm.toFixed(1)}mm`,
      appliedWeight: rainWeight,
      impactScore: rainImpact,
    });
    adjustedSales += rainImpact;
    adjustedBagels *= 1 + rainWeight;
    adjustmentTexts.push(`비 예보 (${rainMm.toFixed(1)}mm)로 인해 매출이 하향 조정됨 (${(rainWeight * 100).toFixed(0)}%)`);
  }

  // Hot weather
  const maxTemp = safeNumber(externalFactors.maxTemp, 0);
  if (maxTemp > 28) {
    const hotWeight = safeNumber(weights["weather_hot"], -0.05);
    const hotImpact = roundSalesValue(adjustedSales * hotWeight);
    factors.push({
      factorKey: "weather_hot",
      factorLabel: "더위 (기온)",
      factorValue: `${maxTemp.toFixed(1)}°C`,
      appliedWeight: hotWeight,
      impactScore: hotImpact,
    });
    adjustedSales += hotImpact;
    adjustedBagels *= 1 + hotWeight;
    adjustmentTexts.push(`높은 기온 (${maxTemp.toFixed(1)}°C)으로 인해 매출이 소폭 하향 조정됨`);
  }

  // Holiday
  if (externalFactors.holidayName) {
    const holidayWeight = safeNumber(weights["holiday"], 0.3);
    const holidayImpact = roundSalesValue(adjustedSales * holidayWeight);
    factors.push({
      factorKey: "holiday",
      factorLabel: "공휴일",
      factorValue: externalFactors.holidayName,
      appliedWeight: holidayWeight,
      impactScore: holidayImpact,
    });
    adjustedSales += holidayImpact;
    adjustedBagels *= 1 + holidayWeight;
    adjustmentTexts.push(`공휴일 (${externalFactors.holidayName}) 효과로 판매량이 상향 조정됨 (+${(holidayWeight * 100).toFixed(0)}%)`);
  }

  // Local event
  if (externalFactors.localEventName) {
    const eventWeight = safeNumber(weights["local_event"], 0.2);
    const eventImpact = roundSalesValue(adjustedSales * eventWeight);
    factors.push({
      factorKey: "local_event",
      factorLabel: "지역 이벤트",
      factorValue: externalFactors.localEventName,
      appliedWeight: eventWeight,
      impactScore: eventImpact,
    });
    adjustedSales += eventImpact;
    adjustedBagels *= 1 + eventWeight;
    adjustmentTexts.push(`지역 이벤트 (${externalFactors.localEventName}) 효과로 매출이 상향 조정됨`);
  }

  // School holiday
  if (externalFactors.schoolHoliday) {
    const schoolWeight = safeNumber(weights["school_holiday"], 0.1);
    const schoolImpact = roundSalesValue(adjustedSales * schoolWeight);
    factors.push({
      factorKey: "school_holiday",
      factorLabel: "학교 방학",
      factorValue: "방학 중",
      appliedWeight: schoolWeight,
      impactScore: schoolImpact,
    });
    adjustedSales += schoolImpact;
    adjustedBagels *= 1 + schoolWeight;
    adjustmentTexts.push(`학교 방학 기간으로 가족 고객 증가 가능성 반영됨 (+${(schoolWeight * 100).toFixed(0)}%)`);
  }

  // News impact
  const hasNegativeNzNews = externalFactors.nzNewsSummary && externalFactors.nzNewsSummary.length > 10;
  if (hasNegativeNzNews) {
    const newsWeight = safeNumber(weights["nz_news"], -0.05);
    if (newsWeight < 0) {
      const newsImpact = roundSalesValue(adjustedSales * newsWeight);
      factors.push({
        factorKey: "nz_news",
        factorLabel: "뉴질랜드 뉴스",
        factorValue: "부정적 뉴스 영향",
        appliedWeight: newsWeight,
        impactScore: newsImpact,
      });
      adjustedSales += newsImpact;
      adjustedBagels *= 1 + newsWeight;
      adjustmentTexts.push(`뉴스 영향으로 인해 매출이 소폭 하향 반영됨`);
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
    items.push({ type: "info", text: "데이터가 충분하지 않아 기본값을 사용했습니다." });
  } else {
    items.push({
      type: "baseline",
      text: `최근 ${metrics.dataPointCount}일 평균 매출(${Math.round(metrics.avgSales).toLocaleString("ko-KR")}원)이 기준값으로 사용됨`,
    });
  }

  if (metrics.sameDayDataPointCount > 0) {
    const diff = metrics.sameDayAvgSales - metrics.avgSales;
    const direction = diff >= 0 ? "높아 상향" : "낮아 하향";
    items.push({
      type: "weekday",
      text: `같은 요일 평균이 전체 평균보다 ${Math.abs(diff).toFixed(0)}원 ${direction} 반영됨 (${metrics.sameDayDataPointCount}건 참고)`,
    });
  }

  // Adjustments
  for (const text of adjustmentTexts) {
    const type = text.includes("비") || text.includes("기온") ? "weather"
      : text.includes("공휴일") ? "holiday"
      : text.includes("이벤트") ? "event"
      : text.includes("방학") ? "school"
      : text.includes("뉴스") ? "news"
      : "weekday";
    items.push({ type, text });
  }

  // Production recommendation
  const bufferPct = Math.round((production.recommendedBagelsToBake / Math.max(1, predictedBagelsSold) - 1) * 100);
  items.push({
    type: "production",
    text: `최근 폐기율(${(metrics.avgWasteRate * 100).toFixed(1)}%)을 고려해 예상 판매량 대비 ${bufferPct}% 버퍼를 적용한 생산량 추천`,
  });

  items.push({
    type: "production",
    text: `추천 생산량: ${production.recommendedBagelsToBake}개 (예상 잔여: ${production.predictedLeftovers}개, 예상 판매율: ${(production.projectedSellThroughRate * 100).toFixed(1)}%)`,
  });

  const summary =
    `예상 매출 ${Math.round(predictedSales).toLocaleString("ko-KR")}원, ` +
    `판매 ${predictedBagelsSold}개 기준으로 ` +
    `${production.recommendedBagelsToBake}개 생산을 추천합니다.`;

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
    : "추가 조정 없음";

  const noteParts = [
    `기준 데이터: 최근 ${metrics.dataPointCount}일`,
    metrics.sameDayDataPointCount > 0 ? `같은 요일 ${metrics.sameDayDataPointCount}건 참고` : null,
    `적용 요인: ${factors.length}개`,
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
    method: "rule_based_v2",
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
