import type { SalesPrediction, DailyRecord } from "@/types";

export function safeNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return isNaN(n) ? fallback : n;
}

export function roundSalesValue(value: number): number {
  return Math.round(value * 100) / 100;
}

export function roundBagelCount(value: number): number {
  return Math.max(0, Math.round(value));
}

export function getDayOfWeekKey(date: Date): string {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[date.getDay()];
}

export function normalizeWeightValue(value: number): number {
  // Clamp weight to reasonable range [-1, 2]
  return Math.max(-1, Math.min(2, value));
}

export function applyWeight(baseValue: number, weightValue: number): number {
  return baseValue * (1 + normalizeWeightValue(weightValue));
}

export function calculatePredictionConfidence({
  dataPointCount,
  factorCompleteness,
  hasWeekdayData,
}: {
  dataPointCount: number;
  factorCompleteness: number; // 0-1
  hasWeekdayData: boolean;
}): number {
  // Simple confidence: 0-100
  // More data = more confidence (capped at 60 points for data)
  const dataScore = Math.min(60, dataPointCount * 4);
  // Factor completeness (max 30 points)
  const factorScore = factorCompleteness * 30;
  // Weekday data bonus (10 points)
  const weekdayBonus = hasWeekdayData ? 10 : 0;
  return Math.min(100, Math.round(dataScore + factorScore + weekdayBonus));
}

export type PredictionComparison = {
  predictedSales: number;
  actualSales: number;
  salesError: number;
  salesErrorPct: number;
  predictedBagelsSold: number;
  actualBagelsSold: number;
  bagelsError: number;
  bagelsErrorPct: number;
};

export function comparePredictedVsActual(
  prediction: Pick<SalesPrediction, "predictedSales" | "predictedBagelsSold">,
  actual: Pick<DailyRecord, "storeSales" | "uberSales" | "doordashSales" | "otherSales" | "bagelsBaked" | "bagelsLeft">
): PredictionComparison {
  const actualSales = actual.storeSales + actual.uberSales + actual.doordashSales + actual.otherSales;
  const actualBagelsSold = actual.bagelsBaked - actual.bagelsLeft;
  const salesError = actualSales - prediction.predictedSales;
  const salesErrorPct = prediction.predictedSales !== 0 ? (salesError / prediction.predictedSales) * 100 : 0;
  const bagelsError = actualBagelsSold - prediction.predictedBagelsSold;
  const bagelsErrorPct = prediction.predictedBagelsSold !== 0 ? (bagelsError / prediction.predictedBagelsSold) * 100 : 0;
  return {
    predictedSales: prediction.predictedSales,
    actualSales,
    salesError,
    salesErrorPct,
    predictedBagelsSold: prediction.predictedBagelsSold,
    actualBagelsSold,
    bagelsError,
    bagelsErrorPct,
  };
}
