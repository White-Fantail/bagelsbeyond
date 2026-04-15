/**
 * Profit forecast calculations — pure functions, no I/O.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProductProfitInput = {
  productId: string;
  productName: string;
  predictedSalesQty: number;
  sellingPrice: number | null;
  adjustedUnitCost: number | null;
};

export type ProductProfitRow = {
  productId: string;
  productName: string;
  predictedSalesQty: number;
  sellingPrice: number | null;
  adjustedUnitCost: number | null;
  predictedRevenue: number | null;
  expectedCost: number | null;
  expectedGrossProfit: number | null;
  grossMarginPercent: number | null;
};

export type ProfitForecastTotals = {
  totalPredictedRevenue: number;
  totalExpectedCost: number;
  totalExpectedGrossProfit: number;
  overallGrossMarginPercent: number | null;
};

export type ProfitForecast = {
  products: ProductProfitRow[];
  totals: ProfitForecastTotals;
};

// ─── Calculation helpers ──────────────────────────────────────────────────────

export function calculateProductProfit(input: ProductProfitInput): ProductProfitRow {
  const { productId, productName, predictedSalesQty, sellingPrice, adjustedUnitCost } = input;

  const predictedRevenue =
    sellingPrice !== null ? predictedSalesQty * sellingPrice : null;
  const expectedCost =
    adjustedUnitCost !== null ? predictedSalesQty * adjustedUnitCost : null;
  const expectedGrossProfit =
    predictedRevenue !== null && expectedCost !== null
      ? predictedRevenue - expectedCost
      : null;
  const grossMarginPercent =
    predictedRevenue !== null && expectedGrossProfit !== null && predictedRevenue > 0
      ? (expectedGrossProfit / predictedRevenue) * 100
      : null;

  return {
    productId,
    productName,
    predictedSalesQty,
    sellingPrice,
    adjustedUnitCost,
    predictedRevenue,
    expectedCost,
    expectedGrossProfit,
    grossMarginPercent,
  };
}

/**
 * Calculate profit forecast for a list of products.
 * Totals aggregate over all products that have costing data.
 */
export function calculateExpectedProfit(inputs: ProductProfitInput[]): ProfitForecast {
  const products = inputs.map(calculateProductProfit);

  let totalRevenue = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let hasRevenue = false;

  for (const p of products) {
    if (p.predictedRevenue !== null) {
      totalRevenue += p.predictedRevenue;
      hasRevenue = true;
    }
    if (p.expectedCost !== null) {
      totalCost += p.expectedCost;
    }
    if (p.expectedGrossProfit !== null) {
      totalProfit += p.expectedGrossProfit;
    }
  }

  const overallGrossMarginPercent =
    hasRevenue && totalRevenue > 0
      ? (totalProfit / totalRevenue) * 100
      : null;

  return {
    products,
    totals: {
      totalPredictedRevenue: totalRevenue,
      totalExpectedCost: totalCost,
      totalExpectedGrossProfit: totalProfit,
      overallGrossMarginPercent,
    },
  };
}
