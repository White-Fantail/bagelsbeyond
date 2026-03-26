// ─── Order Service ────────────────────────────────────────────────────────────
// Core order domain logic: create draft orders, calculate totals.
//
// Design principles:
// - All order types (internal, subscription, POS-imported) share this structure
// - The `source` field distinguishes the origin
// - Snapshot fields (productNameSnapshot, unitPriceSnapshot) preserve order
//   history even after product names/prices change
// - Payment and fulfillment logic are intentionally NOT coupled here;
//   they should be added as separate services in future phases

import { prisma } from "@/lib/db";
import { OrderSource, FulfillmentType } from "@/app/generated/prisma/enums";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateOrderItemInput {
  productId?: string;
  productNameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
  note?: string;
  options?: {
    optionGroupNameSnapshot: string;
    optionNameSnapshot: string;
    priceDeltaSnapshot: number;
    quantity?: number;
  }[];
}

export interface CreateOrderInput {
  userId?: string;
  source?: OrderSource;
  fulfillmentType?: FulfillmentType;
  pickupDate?: Date;
  pickupTimeSlot?: string;
  customerNameSnapshot?: string;
  customerEmailSnapshot?: string;
  customerPhoneSnapshot?: string;
  discountAmount?: number;
  note?: string;
  items: CreateOrderItemInput[];
}

// ─── Order Number Generator ───────────────────────────────────────────────────

function generateOrderNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0");
  return `ORD-${datePart}-${randomPart}`;
}

// ─── Total Calculator ─────────────────────────────────────────────────────────

export function calculateOrderTotals(
  items: CreateOrderItemInput[],
  discountAmount = 0
): { subtotalAmount: number; totalAmount: number } {
  const subtotalAmount = items.reduce((sum, item) => {
    const optionsDelta = (item.options ?? []).reduce(
      (optSum, opt) => optSum + opt.priceDeltaSnapshot * (opt.quantity ?? 1),
      0
    );
    const lineTotal = (item.unitPriceSnapshot + optionsDelta) * item.quantity;
    return sum + lineTotal;
  }, 0);

  const totalAmount = Math.max(0, subtotalAmount - discountAmount);
  return { subtotalAmount, totalAmount };
}

// ─── Create Draft Order ───────────────────────────────────────────────────────

/**
 * Create a DRAFT order with all items and options.
 * The order starts in DRAFT/UNPAID status — caller is responsible for
 * transitioning to PENDING/CONFIRMED after payment/validation.
 *
 * Extension points:
 * - For subscription orders: set source = OrderSource.SUBSCRIPTION
 * - For POS-imported orders: set source = OrderSource.POS_IMPORTED
 * - After creating, call pushOrderToPOS() if POS sync is required
 * - After creating, decrement DailyInventory.reservedQty as appropriate
 */
export async function createDraftOrder(input: CreateOrderInput) {
  const { subtotalAmount, totalAmount } = calculateOrderTotals(
    input.items,
    input.discountAmount ?? 0
  );

  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      userId: input.userId,
      source: input.source ?? OrderSource.INTERNAL,
      fulfillmentType: input.fulfillmentType ?? FulfillmentType.PICKUP,
      pickupDate: input.pickupDate,
      pickupTimeSlot: input.pickupTimeSlot,
      customerNameSnapshot: input.customerNameSnapshot,
      customerEmailSnapshot: input.customerEmailSnapshot,
      customerPhoneSnapshot: input.customerPhoneSnapshot,
      subtotalAmount,
      discountAmount: input.discountAmount ?? 0,
      totalAmount,
      note: input.note,
      items: {
        create: input.items.map((item) => {
          const optionsDelta = (item.options ?? []).reduce(
            (s, o) => s + o.priceDeltaSnapshot * (o.quantity ?? 1),
            0
          );
          const lineTotal = (item.unitPriceSnapshot + optionsDelta) * item.quantity;
          return {
            productId: item.productId,
            productNameSnapshot: item.productNameSnapshot,
            unitPriceSnapshot: item.unitPriceSnapshot,
            quantity: item.quantity,
            lineTotal,
            note: item.note,
            options: item.options
              ? {
                  create: item.options.map((opt) => ({
                    optionGroupNameSnapshot: opt.optionGroupNameSnapshot,
                    optionNameSnapshot: opt.optionNameSnapshot,
                    priceDeltaSnapshot: opt.priceDeltaSnapshot,
                    quantity: opt.quantity ?? 1,
                  })),
                }
              : undefined,
          };
        }),
      },
    },
    include: {
      items: { include: { options: true } },
    },
  });

  return order;
}
