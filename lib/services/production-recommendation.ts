import { prisma } from "@/lib/db";
import { OrderStatus } from "@/app/generated/prisma/enums";
import { buildPredictionInput, calculateRuleBasedPrediction } from "./predictionService";
import { safeNumber, roundBagelCount } from "@/lib/prediction-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProductRecommendation = {
  productId: string;
  productName: string;
  confirmedQty: number;
  predictedQty: number;
  recommendedQty: number;
};

export type ProductionRecommendationResult = {
  date: string;
  confirmedQty: number;
  subscriptionQty: number;
  predictedExtraQty: number;
  safetyBufferQty: number;
  existingStockQty: number;
  recommendedTotalQty: number;
  productRecommendations: ProductRecommendation[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateRange(date: Date): { dayStart: Date; dayEnd: Date } {
  const dateStr = date.toISOString().split("T")[0];
  const dayStart = new Date(dateStr + "T00:00:00.000Z");
  const nextDay = new Date(dayStart);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const dayEnd = nextDay;
  return { dayStart, dayEnd };
}

// ─── Confirmed Demand ─────────────────────────────────────────────────────────

/**
 * Returns confirmed order quantities for a given pickup date.
 * Includes INTERNAL and SUBSCRIPTION orders that are not CANCELLED.
 */
export async function getConfirmedDemand(date: Date): Promise<{
  totalQty: number;
  orderQty: number;
  subscriptionQty: number;
  productQtyMap: Record<string, number>;
}> {
  const { dayStart, dayEnd } = toDateRange(date);

  const orders = await prisma.order.findMany({
    where: {
      pickupDate: { gte: dayStart, lt: dayEnd },
      status: { not: OrderStatus.CANCELLED },
      source: { in: ["INTERNAL", "SUBSCRIPTION"] },
    },
    include: {
      items: {
        select: { productId: true, quantity: true, productNameSnapshot: true },
      },
    },
  });

  const productQtyMap: Record<string, number> = {};
  let orderQty = 0;
  let subscriptionQty = 0;

  for (const order of orders) {
    const itemTotal = order.items.reduce((sum, item) => sum + item.quantity, 0);
    if (order.source === "SUBSCRIPTION") {
      subscriptionQty += itemTotal;
    } else {
      orderQty += itemTotal;
    }

    for (const item of order.items) {
      if (!item.productId) {
        // Skip items without a product ID — they cannot be tracked per product
        continue;
      }
      productQtyMap[item.productId] = (productQtyMap[item.productId] ?? 0) + item.quantity;
    }
  }

  return {
    totalQty: orderQty + subscriptionQty,
    orderQty,
    subscriptionQty,
    productQtyMap,
  };
}

// ─── Predicted Demand ─────────────────────────────────────────────────────────

/**
 * Returns total predicted bagels sold using the existing prediction engine.
 * This covers all demand (confirmed + walk-in), so subtract confirmedQty to
 * get only the extra walk-in demand.
 */
export async function getPredictedDemand(date: Date): Promise<number> {
  const input = await buildPredictionInput(date);
  const result = calculateRuleBasedPrediction(input);
  return Math.max(0, result.predictedBagelsSold);
}

// ─── Safety Buffer ────────────────────────────────────────────────────────────

/**
 * Calculates a safety buffer on top of predicted extra demand.
 * Base: 10% of predictedQty.
 * Adjustments:
 *   - Weekend: +20%
 *   - Rainy day: −20% (lower foot traffic)
 *   - Local event or holiday: +5%
 *
 * The bufferRate structure is intentionally kept as a configurable object
 * so it can later be stored in AppSetting or PredictionWeight.
 */
export async function getSafetyBuffer(date: Date, predictedQty: number): Promise<number> {
  const { dayStart, dayEnd } = toDateRange(date);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  const externalFactor = await prisma.dailyExternalFactor.findFirst({
    where: { date: { gte: dayStart, lt: dayEnd } },
  });

  const policy = {
    base: 0.1,
    weekendMultiplier: 1.2,
    rainMultiplier: 0.8,
    eventBonus: 0.05,
  };

  let bufferRate = policy.base;

  if (isWeekend) {
    bufferRate *= policy.weekendMultiplier;
  }

  const rainMm = safeNumber(externalFactor?.rainMm, 0);
  if (rainMm > 0) {
    bufferRate *= policy.rainMultiplier;
  }

  if (externalFactor?.localEventName || externalFactor?.holidayName) {
    bufferRate += policy.eventBonus;
  }

  return roundBagelCount(predictedQty * bufferRate);
}

// ─── Existing Stock ───────────────────────────────────────────────────────────

/**
 * Returns the total leftover stock from the previous day.
 * Primary source: DailyInventory (bakedQty − soldQty per product, min 0).
 * Fallback: DailyRecord.bagelsLeft if no DailyInventory data exists.
 */
export async function getExistingStock(date: Date): Promise<number> {
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const { dayStart: prevStart, dayEnd: prevEnd } = toDateRange(yesterday);

  const inventories = await prisma.dailyInventory.findMany({
    where: { date: { gte: prevStart, lt: prevEnd } },
  });

  const inventoryLeftover = inventories.reduce((sum, inv) => {
    return sum + Math.max(0, inv.bakedQty - inv.soldQty);
  }, 0);

  if (inventoryLeftover > 0) {
    return inventoryLeftover;
  }

  // Fallback to DailyRecord.bagelsLeft
  const prevRecord = await prisma.dailyRecord.findFirst({
    where: { date: { gte: prevStart, lt: prevEnd } },
  });

  return safeNumber(prevRecord?.bagelsLeft, 0);
}

// ─── Product-Level Recommendation ────────────────────────────────────────────

/**
 * Distributes the total recommended quantity across individual products
 * using sales ratios from the past 4 weeks.
 * If no historical data exists, the total is split equally across all active bagel products.
 */
export async function getProductLevelRecommendation(
  date: Date,
  totalRecommendedQty: number,
  confirmedProductQtyMap: Record<string, number>
): Promise<ProductRecommendation[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (products.length === 0) return [];

  const fourWeeksAgo = new Date(date);
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const historicalItems = await prisma.orderItem.findMany({
    where: {
      productId: { in: products.map((p) => p.id) },
      order: {
        pickupDate: { gte: fourWeeksAgo, lt: date },
        status: { not: OrderStatus.CANCELLED },
      },
    },
    select: { productId: true, quantity: true },
  });

  // Sum historical quantities per product
  const historicalQtyMap: Record<string, number> = {};
  for (const item of historicalItems) {
    if (item.productId) {
      historicalQtyMap[item.productId] = (historicalQtyMap[item.productId] ?? 0) + item.quantity;
    }
  }

  const totalHistorical = Object.values(historicalQtyMap).reduce((s, q) => s + q, 0);

  return products.map((product) => {
    const confirmedQty = confirmedProductQtyMap[product.id] ?? 0;

    const ratio =
      totalHistorical > 0
        ? (historicalQtyMap[product.id] ?? 0) / totalHistorical
        : 1 / products.length;

    const predictedQty = roundBagelCount(totalRecommendedQty * ratio);
    const recommendedQty = Math.max(confirmedQty, predictedQty);

    return {
      productId: product.id,
      productName: product.name,
      confirmedQty,
      predictedQty,
      recommendedQty,
    };
  });
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Calculates production recommendation for a given date.
 *
 * Formula:
 *   recommendedTotalQty =
 *     confirmedQty + predictedExtraQty + safetyBufferQty − existingStockQty
 *   (minimum 0)
 */
export async function getProductionRecommendation(
  date: Date
): Promise<ProductionRecommendationResult> {
  const dateStr = date.toISOString().split("T")[0];

  // Step 1: Confirmed demand (orders + subscriptions)
  const {
    totalQty: confirmedQty,
    subscriptionQty,
    productQtyMap: confirmedProductQtyMap,
  } = await getConfirmedDemand(date);

  // Step 2: Predicted demand (from prediction engine) minus confirmed orders
  const rawPredicted = await getPredictedDemand(date);
  const predictedExtraQty = Math.max(0, rawPredicted - confirmedQty);

  // Step 3: Safety buffer on top of the extra predicted demand
  const safetyBufferQty = await getSafetyBuffer(date, predictedExtraQty);

  // Step 4: Existing stock (yesterday's leftover)
  const existingStockQty = await getExistingStock(date);

  // Step 5: Total recommended (min 0)
  const rawTotal = confirmedQty + predictedExtraQty + safetyBufferQty - existingStockQty;
  const recommendedTotalQty = Math.max(0, roundBagelCount(rawTotal));

  // Step 6: Per-product breakdown
  const productRecommendations = await getProductLevelRecommendation(
    date,
    recommendedTotalQty,
    confirmedProductQtyMap
  );

  return {
    date: dateStr,
    confirmedQty,
    subscriptionQty,
    predictedExtraQty,
    safetyBufferQty,
    existingStockQty,
    recommendedTotalQty,
    productRecommendations,
  };
}
