// ─── Order Sync Service ───────────────────────────────────────────────────────
// Pushes internal Orders to an external POS and tracks sync status via
// ExternalOrderMap.
//
// Policy:
//   - Orders that have already been successfully sent (syncStatus "success" or
//     legacy "synced") are skipped to prevent duplicate POS receipts.
//   - Every OrderItem must have a matching ExternalProductMap row; if any item
//     is unmapped the push is aborted and marked "failed" with a descriptive
//     error message.
//   - OrderItemOption modifiers are included in the receipt line items using
//     the option name snapshot and price delta (no Loyverse modifier ID needed).
//   - requestSummary / responseSummary are written for diagnostics.

import { prisma } from "@/lib/db";
import type { POSAdapter } from "../adapters/pos/types";
import { IntegrationSource } from "@/app/generated/prisma/enums";

export interface OrderSyncResult {
  orderId: string;
  success: boolean;
  skipped?: boolean;
  externalOrderId?: string;
  error?: string;
}

/** Returns true when a syncStatus value represents a successful prior push. */
function isAlreadySynced(status: string | null | undefined): boolean {
  return status === "success" || status === "synced";
}

/**
 * Push a single internal order to the external POS and record the result.
 *
 * - Skips orders that were already successfully pushed.
 * - Validates that every OrderItem has an ExternalProductMap entry.
 * - Includes OrderItemOption modifiers in the receipt payload.
 * - Writes requestSummary / responseSummary for diagnostics.
 *
 * Usage:
 *   const adapter = createLoyverseAdapter();
 *   const result = await pushOrderToPOS(orderId, adapter, IntegrationSource.LOYVERSE);
 *
 * To force a retry of a failed order, set forceRetry = true.
 */
export async function pushOrderToPOS(
  orderId: string,
  adapter: POSAdapter,
  source: IntegrationSource,
  { forceRetry = false }: { forceRetry?: boolean } = {}
): Promise<OrderSyncResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { options: true } } },
  });

  if (!order) {
    return { orderId, success: false, error: "Order not found" };
  }

  // ── Skip already-sent orders (duplicate prevention) ────────────────────────
  if (!forceRetry) {
    const existing = await prisma.externalOrderMap.findUnique({
      where: { orderId },
    });
    if (isAlreadySynced(existing?.syncStatus)) {
      return {
        orderId,
        success: true,
        skipped: true,
        externalOrderId: existing?.externalOrderId ?? undefined,
      };
    }
  }

  // ── Validate product mappings ──────────────────────────────────────────────
  const productIds = order.items
    .map((i) => i.productId)
    .filter((id): id is string => Boolean(id));

  const productMappings = await prisma.externalProductMap.findMany({
    where: { productId: { in: productIds }, source },
  });
  const mappingByProductId = new Map(
    productMappings.map((m) => [m.productId, m.externalProductId])
  );

  const unmappedItems = order.items.filter(
    (item) => !item.productId || !mappingByProductId.has(item.productId)
  );

  if (unmappedItems.length > 0) {
    const names = unmappedItems.map((i) => `"${i.productNameSnapshot}"`).join(", ");
    const errorMessage = `Loyverse 상품 매핑 누락: ${names}`;
    await prisma.externalOrderMap.upsert({
      where: { orderId },
      update: {
        syncStatus: "failed",
        errorMessage,
        lastSyncedAt: new Date(),
      },
      create: {
        source,
        orderId,
        externalOrderId: null,
        syncStatus: "failed",
        errorMessage,
        lastSyncedAt: new Date(),
      },
    });
    return { orderId, success: false, error: errorMessage };
  }

  // ── Build request payload ──────────────────────────────────────────────────
  const notePrefix = order.source ? `[${order.source}]` : "";
  const noteBody = order.note ?? "";
  const note = [notePrefix, noteBody].filter(Boolean).join(" ");

  const externalOrderItems = order.items.map((item) => ({
    externalProductId: mappingByProductId.get(item.productId ?? "") ?? "",
    productName: item.productNameSnapshot,
    quantity: item.quantity,
    unitPrice: item.unitPriceSnapshot,
    lineTotal: item.lineTotal,
    modifiers: item.options.map((opt) => ({
      name: opt.optionNameSnapshot,
      price: opt.priceDeltaSnapshot,
      quantity: opt.quantity,
    })),
  }));

  const externalOrder = {
    externalId: order.orderNumber,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    note: note || undefined,
    items: externalOrderItems,
  };

  const requestSummary = JSON.stringify({
    orderNumber: order.orderNumber,
    source: order.source,
    itemCount: order.items.length,
    optionCount: order.items.reduce((s, i) => s + i.options.length, 0),
  });

  // ── Mark as PENDING ────────────────────────────────────────────────────────
  await prisma.externalOrderMap.upsert({
    where: { orderId },
    update: {
      syncStatus: "pending",
      errorMessage: null,
      requestSummary,
    },
    create: {
      source,
      orderId,
      externalOrderId: null,
      syncStatus: "pending",
      requestSummary,
    },
  });

  // ── Push to POS ────────────────────────────────────────────────────────────
  const pushResult = await adapter.pushOrderToExternalPos(externalOrder);

  await prisma.externalOrderMap.update({
    where: { orderId },
    data: {
      syncStatus: pushResult.success ? "success" : "failed",
      externalOrderId: pushResult.success
        ? (pushResult.data?.externalOrderId ?? null)
        : null,
      lastSyncedAt: pushResult.success ? new Date() : new Date(),
      errorMessage: pushResult.error ?? null,
      requestSummary,
      responseSummary: JSON.stringify(
        pushResult.success ? pushResult.data : pushResult.error
      ),
    },
  });

  return {
    orderId,
    success: pushResult.success,
    externalOrderId: pushResult.data?.externalOrderId,
    error: pushResult.error,
  };
}

