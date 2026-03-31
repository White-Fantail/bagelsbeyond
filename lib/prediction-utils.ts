import type { SalesPrediction, DailyRecord, PredictionExplanation } from "@/types";

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

export function getDayOfWeekLabel(date: Date): string {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return labels[date.getDay()];
}

export function normalizeWeightValue(value: number): number {
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
  factorCompleteness: number;
  hasWeekdayData: boolean;
}): number {
  const dataScore = Math.min(60, dataPointCount * 4);
  const factorScore = factorCompleteness * 30;
  const weekdayBonus = hasWeekdayData ? 10 : 0;
  return Math.min(100, Math.round(dataScore + factorScore + weekdayBonus));
}

export type PredictionComparison = {
  predictedSales: number;
  actualSales: number;
  salesError: number;
  salesErrorAbs: number;
  salesErrorPct: number;
  predictedBagelsSold: number;
  actualBagelsSold: number;
  bagelsError: number;
  bagelsErrorAbs: number;
  bagelsErrorPct: number;
  predictedLeftovers: number;
  actualLeftovers: number;
  leftoversError: number;
  leftoversErrorAbs: number;
  direction: "over" | "under" | "accurate";
  label: string;
};

export function comparePredictedVsActual(
  prediction: Pick<SalesPrediction, "predictedSales" | "predictedBagelsSold" | "predictedLeftovers" | "recommendedBagelsToBake">,
  actual: Pick<DailyRecord, "storeSales" | "uberSales" | "doordashSales" | "otherSales" | "bagelsBaked" | "bagelsLeft">
): PredictionComparison {
  const actualSales = safeNumber(actual.storeSales) + safeNumber(actual.uberSales) + safeNumber(actual.doordashSales) + safeNumber(actual.otherSales);
  const actualBagelsSold = safeNumber(actual.bagelsBaked) - safeNumber(actual.bagelsLeft);
  const actualLeftovers = safeNumber(actual.bagelsLeft);

  const salesError = actualSales - prediction.predictedSales;
  const salesErrorAbs = Math.abs(salesError);
  const salesErrorPct = prediction.predictedSales !== 0 ? (salesError / prediction.predictedSales) * 100 : 0;

  const bagelsError = actualBagelsSold - prediction.predictedBagelsSold;
  const bagelsErrorAbs = Math.abs(bagelsError);
  const bagelsErrorPct = prediction.predictedBagelsSold !== 0 ? (bagelsError / prediction.predictedBagelsSold) * 100 : 0;

  const leftoversError = actualLeftovers - safeNumber(prediction.predictedLeftovers);
  const leftoversErrorAbs = Math.abs(leftoversError);

  // Accuracy direction is based on bagel count, not revenue — bagel count is what drives operations
  const absBagelsPct = Math.abs(bagelsErrorPct);
  let direction: "over" | "under" | "accurate";
  if (absBagelsPct <= 5) direction = "accurate";
  else if (bagelsError < 0) direction = "over"; // predicted more bagels than actually sold
  else direction = "under"; // predicted fewer bagels than actually sold

  const label = getBagelAccuracyLabel(bagelsErrorPct);

  return {
    predictedSales: prediction.predictedSales,
    actualSales,
    salesError,
    salesErrorAbs,
    salesErrorPct,
    predictedBagelsSold: prediction.predictedBagelsSold,
    actualBagelsSold,
    bagelsError,
    bagelsErrorAbs,
    bagelsErrorPct,
    predictedLeftovers: safeNumber(prediction.predictedLeftovers),
    actualLeftovers,
    leftoversError,
    leftoversErrorAbs,
    direction,
    label,
  };
}

export function getPredictionAccuracyLabel(salesErrorPct: number): string {
  const abs = Math.abs(salesErrorPct);
  if (abs <= 5) return "Accurate";
  if (abs <= 10) return salesErrorPct > 0 ? "Slightly underpredicted" : "Slightly overpredicted";
  if (abs <= 20) return salesErrorPct > 0 ? "Underpredicted" : "Overpredicted";
  return salesErrorPct > 0 ? "Significantly underpredicted" : "Significantly overpredicted";
}

// Bagel-count accuracy label (used as the primary accuracy signal)
export function getBagelAccuracyLabel(bagelsErrorPct: number): string {
  const abs = Math.abs(bagelsErrorPct);
  if (abs <= 5) return "Accurate";
  if (abs <= 10) return bagelsErrorPct > 0 ? "Slightly underpredicted" : "Slightly overpredicted";
  if (abs <= 20) return bagelsErrorPct > 0 ? "Underpredicted" : "Overpredicted";
  return bagelsErrorPct > 0 ? "Significantly underpredicted" : "Significantly overpredicted";
}

export function calculateErrorRate(predicted: number, actual: number): number {
  if (predicted === 0) return actual === 0 ? 0 : 100;
  return ((actual - predicted) / predicted) * 100;
}

export function parsePredictionExplanation(explanationJson: string | null | undefined): PredictionExplanation | null {
  if (!explanationJson) return null;
  try {
    return JSON.parse(explanationJson) as PredictionExplanation;
  } catch {
    return null;
  }
}
