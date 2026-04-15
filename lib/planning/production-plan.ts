/**
 * Production plan calculation helpers — pure functions, no I/O.
 * These are reusable in tests and services.
 */

export type RoundingMode = "NONE" | "ROUND_UP" | "ROUND_DOWN" | "ROUND_NEAREST";
export type BatchHandlingMode = "IGNORE" | "ROUND_UP" | "ROUND_NEAREST";

export type ProductionRecommendationInput = {
  predictedSalesQty: number;
  bufferPercent: number;
  /** Batch size, or null/0 to ignore batches */
  batchSize: number | null;
  roundingMode: RoundingMode;
  batchHandlingMode: BatchHandlingMode;
};

export type ProductionRecommendationOutput = {
  predictedSalesQty: number;
  bufferedTargetQty: number;
  recommendedProductionQty: number;
  batchSize: number | null;
  /** Batch count (null when batchSize is not applicable) */
  recommendedBatchCount: number | null;
};

/**
 * Apply rounding mode to a quantity.
 */
export function applyRounding(qty: number, mode: RoundingMode): number {
  switch (mode) {
    case "ROUND_UP":
      return Math.ceil(qty);
    case "ROUND_DOWN":
      return Math.floor(qty);
    case "ROUND_NEAREST":
      return Math.round(qty);
    case "NONE":
    default:
      return qty;
  }
}

/**
 * Calculate the buffered target quantity.
 * bufferedTargetQty = predictedSalesQty × (1 + bufferPercent / 100)
 */
export function calculateBufferedTarget(
  predictedSalesQty: number,
  bufferPercent: number
): number {
  return predictedSalesQty * (1 + bufferPercent / 100);
}

/**
 * Calculate recommended batch count given a required quantity and batch size.
 * - ROUND_UP: ceil(required / batchSize)  — never under-produce
 * - ROUND_NEAREST: round(required / batchSize)
 * - IGNORE: not applicable, returns null
 */
export function calculateBatchCount(
  requiredQty: number,
  batchSize: number,
  mode: BatchHandlingMode
): number {
  if (batchSize <= 0) return 1;
  const raw = requiredQty / batchSize;
  switch (mode) {
    case "ROUND_UP":
      return Math.ceil(raw);
    case "ROUND_NEAREST":
      return Math.max(1, Math.round(raw));
    case "IGNORE":
    default:
      return Math.ceil(raw);
  }
}

/**
 * Build a production recommendation for a single product.
 *
 * Example:
 *   predicted = 19, buffer = 10% → buffered = 20.9
 *   batchSize = 6, mode = ROUND_UP → batches = ceil(20.9/6) = 4, production = 24
 */
export function buildProductionRecommendation(
  input: ProductionRecommendationInput
): ProductionRecommendationOutput {
  const { predictedSalesQty, bufferPercent, batchSize, roundingMode, batchHandlingMode } = input;

  const bufferedTargetQty = calculateBufferedTarget(predictedSalesQty, bufferPercent);

  if (!batchSize || batchSize <= 0) {
    // No batch size — just apply rounding to the buffered target
    const recommendedProductionQty = applyRounding(bufferedTargetQty, roundingMode);
    return {
      predictedSalesQty,
      bufferedTargetQty,
      recommendedProductionQty,
      batchSize: null,
      recommendedBatchCount: null,
    };
  }

  // Batch-based: calculate batch count, then production = batchCount × batchSize
  if (batchHandlingMode === "IGNORE") {
    const recommendedProductionQty = applyRounding(bufferedTargetQty, roundingMode);
    return {
      predictedSalesQty,
      bufferedTargetQty,
      recommendedProductionQty,
      batchSize,
      recommendedBatchCount: null,
    };
  }

  const recommendedBatchCount = calculateBatchCount(bufferedTargetQty, batchSize, batchHandlingMode);
  const recommendedProductionQty = recommendedBatchCount * batchSize;

  return {
    predictedSalesQty,
    bufferedTargetQty,
    recommendedProductionQty,
    batchSize,
    recommendedBatchCount,
  };
}
