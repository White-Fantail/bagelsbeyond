// ─── Daily Order Push Service ─────────────────────────────────────────────────
// Orchestrates the daily flow of:
//   1. Ensuring today's subscription occurrences are generated
//   2. Converting SCHEDULED occurrences to Orders
//   3. Fetching today's INTERNAL + SUBSCRIPTION orders
//   4. Pushing un-sent orders to Loyverse
//
// Policy:
//   - "Today" is determined by the business timezone (APP_TIMEZONE env var).
//   - Only orders with pickupDate = today are pushed.
//   - Orders that are CANCELLED are excluded.
//   - Orders already successfully pushed are skipped (duplicate prevention).
//   - Orders with missing product mappings are marked FAILED and reported.
//   - Future-dated orders are never pushed by this service.

import { prisma } from "@/lib/db";
import {
  OrderSource,
  OrderStatus,
  IntegrationSource,
} from "@/app/generated/prisma/enums";
import {
  createLoyverseAdapter,
  isLoyverseMockMode,
} from "@/lib/integrations/adapters/pos/loyverse";
import { pushOrderToPOS } from "@/lib/integrations/services/order-sync";
import {
  generateOccurrencesForDate,
  generateOrdersFromOccurrences,
} from "@/lib/services/subscriptionService";
import { getBusinessDate, toBusinessDateString } from "@/lib/utils/business-date";

// ─── Result types ─────────────────────────────────────────────────────────────

export interface OrderPushError {
  orderId: string;
  orderNumber: string;
  source: string;
  reason: string;
}

export interface DailyOrderPushResult {
  date: string;
  mockMode: boolean;
  ensuredOccurrences: number;
  ensuredSubscriptionOrders: number;
  pushAttempted: number;
  pushSucceeded: number;
  pushFailed: number;
  skippedAlreadySent: number;
  skippedInvalid: number;
  errors: OrderPushError[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch all orders eligible for today's auto-push:
 *   - pickupDate = targetDate
 *   - status != CANCELLED
 *   - source IN (INTERNAL, SUBSCRIPTION)
 */
export async function getTodayOrdersToPush(targetDate: Date) {
  return prisma.order.findMany({
    where: {
      pickupDate: targetDate,
      status: { not: OrderStatus.CANCELLED },
      source: { in: [OrderSource.INTERNAL, OrderSource.SUBSCRIPTION] },
    },
    include: {
      items: { include: { options: true } },
      externalMapping: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

// ─── Main orchestration ───────────────────────────────────────────────────────

/**
 * Run the full daily order push sync for the given date.
 *
 * Flow:
 *   1. Determine targetDate (default: today in business timezone)
 *   2. Ensure today's subscription occurrences exist
 *   3. Convert SCHEDULED occurrences → Orders
 *   4. Fetch all today's INTERNAL + SUBSCRIPTION orders
 *   5. Skip orders already successfully pushed
 *   6. Push remaining orders to Loyverse (validates product mappings)
 *   7. Aggregate and return results
 *
 * @param targetDate  UTC-midnight date to process (defaults to today)
 */
export async function runDailyOrderPushSync(
  targetDate?: Date
): Promise<DailyOrderPushResult> {
  const date = targetDate ?? getBusinessDate();
  const dateStr = toBusinessDateString(date);
  const mockMode = isLoyverseMockMode();

  const errors: OrderPushError[] = [];

  // ── Step 1: Ensure subscription occurrences for today ─────────────────────
  let ensuredOccurrences = 0;
  try {
    const occResult = await generateOccurrencesForDate(date);
    ensuredOccurrences = occResult.created;
  } catch (err) {
    errors.push({
      orderId: "",
      orderNumber: "",
      source: "SYSTEM",
      reason: `구독 발생 생성 실패: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // ── Step 2: Convert SCHEDULED occurrences → Orders ────────────────────────
  let ensuredSubscriptionOrders = 0;
  try {
    const orderResult = await generateOrdersFromOccurrences(date);
    ensuredSubscriptionOrders = orderResult.ordersCreated;
  } catch (err) {
    errors.push({
      orderId: "",
      orderNumber: "",
      source: "SYSTEM",
      reason: `구독 주문 생성 실패: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // ── Step 3: Fetch today's orders ──────────────────────────────────────────
  const orders = await getTodayOrdersToPush(date);

  // ── Step 4–6: Push orders, tracking results ───────────────────────────────
  const adapter = createLoyverseAdapter();
  let pushAttempted = 0;
  let pushSucceeded = 0;
  let pushFailed = 0;
  let skippedAlreadySent = 0;

  for (const order of orders) {
    // Skip if already successfully sent
    const currentStatus = order.externalMapping?.syncStatus;
    if (currentStatus === "success" || currentStatus === "synced") {
      skippedAlreadySent++;
      continue;
    }

    pushAttempted++;

    try {
      const result = await pushOrderToPOS(
        order.id,
        adapter,
        IntegrationSource.LOYVERSE
      );

      if (result.skipped) {
        // Race condition: became success between the check above and push
        skippedAlreadySent++;
        pushAttempted--;
      } else if (result.success) {
        pushSucceeded++;
      } else {
        pushFailed++;
        errors.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          source: order.source,
          reason: result.error ?? "Unknown error",
        });
      }
    } catch (err) {
      pushFailed++;
      const reason = err instanceof Error ? err.message : String(err);
      errors.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        source: order.source,
        reason,
      });
    }
  }

  return {
    date: dateStr,
    mockMode,
    ensuredOccurrences,
    ensuredSubscriptionOrders,
    pushAttempted,
    pushSucceeded,
    pushFailed,
    skippedAlreadySent,
    skippedInvalid: 0, // validation failures are counted in pushFailed
    errors,
  };
}
