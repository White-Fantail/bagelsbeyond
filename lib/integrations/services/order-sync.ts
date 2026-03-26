// ─── Order Sync Service ───────────────────────────────────────────────────────
// Pushes internal Orders to an external POS and tracks sync status via
// ExternalOrderMap.

import { prisma } from "@/lib/db";
import type { POSAdapter, ExternalOrder } from "../adapters/pos/types";
import { IntegrationSource } from "@/app/generated/prisma/enums";

export interface OrderSyncResult {
  orderId: string;
  success: boolean;
  externalOrderId?: string;
  error?: string;
}

/**
 * Push a single internal order to the external POS and record the result.
 *
 * Usage:
 *   const adapter = createLoyverseAdapter();
 *   const result = await pushOrderToPOS(orderId, adapter, IntegrationSource.LOYVERSE);
 */
export async function pushOrderToPOS(
  orderId: string,
  adapter: POSAdapter,
  source: IntegrationSource
): Promise<OrderSyncResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { options: true } } },
  });

  if (!order) {
    return { orderId, success: false, error: "Order not found" };
  }

  const externalOrder: ExternalOrder = {
    externalId: order.orderNumber,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    note: order.note ?? undefined,
    items: order.items.map((item) => ({
      externalProductId: item.productId ?? "",
      productName: item.productNameSnapshot,
      quantity: item.quantity,
      unitPrice: item.unitPriceSnapshot,
      lineTotal: item.lineTotal,
    })),
  };

  const pushResult = await adapter.pushOrderToExternalPos(externalOrder);

  // Upsert the ExternalOrderMap to record sync status
  await prisma.externalOrderMap.upsert({
    where: { orderId },
    update: {
      syncStatus: pushResult.success ? "synced" : "failed",
      externalOrderId: pushResult.data?.externalOrderId ?? "",
      lastSyncedAt: pushResult.success ? new Date() : undefined,
      errorMessage: pushResult.error ?? null,
    },
    create: {
      source,
      orderId,
      externalOrderId: pushResult.data?.externalOrderId ?? "",
      syncStatus: pushResult.success ? "synced" : "failed",
      lastSyncedAt: pushResult.success ? new Date() : undefined,
      errorMessage: pushResult.error ?? null,
    },
  });

  return {
    orderId,
    success: pushResult.success,
    externalOrderId: pushResult.data?.externalOrderId,
    error: pushResult.error,
  };
}
