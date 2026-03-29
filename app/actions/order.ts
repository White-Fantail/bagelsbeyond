"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { requireStaffOrAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { PICKUP_TIME_SLOTS, isValidPickupDate } from "@/lib/order/pickup-slots";
import { generateOrderNumber } from "@/lib/order/order-number";
import { OrderStatus } from "@/app/generated/prisma/enums";
import type { CartItem } from "@/types/cart";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateOrderState {
  success?: boolean;
  orderNumber?: string;
  message?: string;
}

// ── Zod schema ────────────────────────────────────────────────────────────────

const createOrderSchema = z.object({
  cartJson: z.string().min(1, "Cart is empty"),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  pickupTimeSlot: z.string().min(1, "Please select a pickup time"),
  note: z.string().optional(),
});

// ── createOrderAction ─────────────────────────────────────────────────────────

export async function createOrderAction(
  prevState: CreateOrderState,
  formData: FormData
): Promise<CreateOrderState> {
  const session = await getSession();
  if (!session?.userId) {
    redirect("/login");
  }

  const parsed = createOrderSchema.safeParse({
    cartJson: formData.get("cartJson"),
    pickupDate: formData.get("pickupDate"),
    pickupTimeSlot: formData.get("pickupTimeSlot"),
    note: formData.get("note") ?? undefined,
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Input error" };
  }

  const { cartJson, pickupDate, pickupTimeSlot, note } = parsed.data;

  // Validate pickup time slot
  if (!PICKUP_TIME_SLOTS.includes(pickupTimeSlot)) {
    return { success: false, message: "Invalid pickup time" };
  }

  // Validate pickup date
  const pickupDateObj = new Date(pickupDate + "T00:00:00.000Z");
  if (!isValidPickupDate(pickupDateObj)) {
    return { success: false, message: "Invalid pickup date. Please select a business day (Mon–Sat)" };
  }

  // Parse cart
  let cart: CartItem[];
  try {
    cart = JSON.parse(cartJson) as CartItem[];
  } catch {
    return { success: false, message: "Invalid cart data" };
  }

  if (!Array.isArray(cart) || cart.length === 0) {
    return { success: false, message: "Cart is empty" };
  }

  // Validate quantity
  for (const item of cart) {
    if (!item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      return { success: false, message: "Invalid quantity" };
    }
  }

  // Fetch products + options from DB for server-side validation and price recalculation
  const productIds = [...new Set(cart.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: {
      optionGroups: {
        include: { options: { where: { isActive: true } } },
      },
    },
  });

  if (products.length !== productIds.length) {
    return { success: false, message: "Contains products that cannot be ordered" };
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Build order items with server-recalculated prices
  interface ServerOrderItem {
    productId: string;
    productNameSnapshot: string;
    unitPriceSnapshot: number;
    quantity: number;
    lineTotal: number;
    options: {
      productOptionId: string;
      optionGroupNameSnapshot: string;
      optionNameSnapshot: string;
      priceDeltaSnapshot: number;
    }[];
  }

  const serverItems: ServerOrderItem[] = [];
  let subtotal = 0;

  for (const cartItem of cart) {
    const product = productMap.get(cartItem.productId);
    if (!product) {
      return { success: false, message: `Product not found: ${cartItem.productId}` };
    }

    // Server recalculate price
    let unitPrice = product.basePrice;
    const resolvedOptions: ServerOrderItem["options"] = [];

    // Validate and resolve each selected option
    for (const sel of cartItem.selectedOptions) {
      const group = product.optionGroups.find((g) => g.id === sel.optionGroupId);
      if (!group) {
        console.error(`[order] Option group not found for internal id: ${sel.optionGroupId}`);
        return { success: false, message: "There was a menu sync issue while submitting your order. Please try again, or contact the store." };
      }
      const option = group.options.find((o) => o.id === sel.optionId);
      if (!option) {
        console.error(`[order] Option not found for internal id: ${sel.optionId}`);
        return { success: false, message: "There was a menu sync issue while submitting your order. Please try again, or contact the store." };
      }
      unitPrice += option.priceDelta;
      resolvedOptions.push({
        productOptionId: option.id,
        optionGroupNameSnapshot: group.name,
        optionNameSnapshot: option.name,
        priceDeltaSnapshot: option.priceDelta,
      });
    }

    // Validate required option groups
    for (const group of product.optionGroups) {
      if (!group.isRequired) continue;
      const selected = cartItem.selectedOptions.filter((s) => s.optionGroupId === group.id);
      if (selected.length < group.minSelect) {
        return {
          success: false,
          message: `"${product.name}please select "${group.name}" option`,
        };
      }
    }

    const lineTotal = Math.round(unitPrice * cartItem.quantity * 100) / 100;
    subtotal += lineTotal;

    serverItems.push({
      productId: product.id,
      productNameSnapshot: product.name,
      unitPriceSnapshot: unitPrice,
      quantity: cartItem.quantity,
      lineTotal,
      options: resolvedOptions,
    });
  }

  subtotal = Math.round(subtotal * 100) / 100;

  // Fetch customer profile for phone
  const customerProfile = await prisma.customerProfile.findUnique({
    where: { userId: session.userId },
    select: { phone: true },
  });

  // Generate unique order number (retry on collision)
  let orderNumber = generateOrderNumber();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.order.findUnique({ where: { orderNumber } });
    if (!existing) break;
    orderNumber = generateOrderNumber();
  }

  // Create order in transaction
  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: session.userId,
          status: "PENDING",
          paymentStatus: "UNPAID",
          fulfillmentType: "PICKUP",
          pickupDate: pickupDateObj,
          pickupTimeSlot,
          customerNameSnapshot: session.name,
          customerEmailSnapshot: session.email,
          customerPhoneSnapshot: customerProfile?.phone ?? null,
          subtotalAmount: subtotal,
          discountAmount: 0,
          totalAmount: subtotal,
          note: note ?? null,
          source: "INTERNAL",
          items: {
            create: serverItems.map((item) => ({
              productId: item.productId,
              productNameSnapshot: item.productNameSnapshot,
              unitPriceSnapshot: item.unitPriceSnapshot,
              quantity: item.quantity,
              lineTotal: item.lineTotal,
              options: {
                create: item.options.map((opt) => ({
                  productOptionId: opt.productOptionId,
                  optionGroupNameSnapshot: opt.optionGroupNameSnapshot,
                  optionNameSnapshot: opt.optionNameSnapshot,
                  priceDeltaSnapshot: opt.priceDeltaSnapshot,
                  quantity: 1,
                })),
              },
            })),
          },
        },
      });

      // Update reservedQty in DailyInventory for each product
      for (const item of serverItems) {
        await tx.dailyInventory.upsert({
          where: { productId_date: { productId: item.productId, date: pickupDateObj } },
          update: { reservedQty: { increment: item.quantity } },
          create: {
            productId: item.productId,
            date: pickupDateObj,
            plannedQty: 0,
            bakedQty: 0,
            reservedQty: item.quantity,
            soldQty: 0,
            isSoldOut: false,
          },
        });
      }

      return order;
    });
  } catch (err) {
    console.error("Order creation failed:", err);
    return { success: false, message: "Error creating order" };
  }

  return { success: true, orderNumber };
}

// ── cancelOrderAction ─────────────────────────────────────────────────────────

export async function cancelOrderAction(
  orderNumber: string
): Promise<{ success: boolean; message?: string }> {
  const session = await getSession();
  if (!session?.userId) {
    redirect("/login");
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: { select: { productId: true, quantity: true } } },
  });

  if (!order || order.userId !== session.userId) {
    return { success: false, message: "Order not found" };
  }

  if (order.status !== "PENDING" && order.status !== "CONFIRMED") {
    return { success: false, message: "Order cannot be cancelled in this status" };
  }

  // Block cancellation if pickup is within 2 hours
  if (order.pickupDate && order.pickupTimeSlot) {
    const [hh, mm] = order.pickupTimeSlot.split(":").map(Number);
    const pickupTime = new Date(order.pickupDate);
    pickupTime.setUTCHours(hh - 12, mm, 0, 0); // NZ is UTC+12 roughly
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    if (pickupTime <= twoHoursFromNow) {
      return { success: false, message: "Cannot cancel within 2 hours of pickup" };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { orderNumber },
        data: { status: "CANCELLED" },
      });

      // Rollback reservedQty
      if (order.pickupDate) {
        for (const item of order.items) {
          if (!item.productId) continue;
          const inv = await tx.dailyInventory.findUnique({
            where: { productId_date: { productId: item.productId, date: order.pickupDate } },
          });
          if (inv) {
            await tx.dailyInventory.update({
              where: { productId_date: { productId: item.productId, date: order.pickupDate } },
              data: { reservedQty: Math.max(0, inv.reservedQty - item.quantity) },
            });
          }
        }
      }
    });
    return { success: true };
  } catch (err) {
    console.error("Order cancellation failed:", err);
    return { success: false, message: "Error processing cancellation" };
  }
}

// ── updateOrderStatusAction ───────────────────────────────────────────────────

// Valid forward transitions (admin/staff)
const STATUS_ORDER: OrderStatus[] = [
  "PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED",
];

export async function updateOrderStatusAction(
  orderNumber: string,
  newStatus: OrderStatus
): Promise<{ success: boolean; message?: string }> {
  const session = await requireStaffOrAdmin();
  if (!session) return { success: false, message: "Unauthorized" };

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: { select: { productId: true, quantity: true } } },
  });

  if (!order) {
    return { success: false, message: "Order not found" };
  }

  // Allow CANCELLED from any non-completed state
  if (newStatus === "CANCELLED") {
    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
      return { success: false, message: "Order is already completed or cancelled" };
    }
  } else {
    // Forward-only transition check
    const currentIdx = STATUS_ORDER.indexOf(order.status as OrderStatus);
    const newIdx = STATUS_ORDER.indexOf(newStatus);
    if (newIdx <= currentIdx) {
      return { success: false, message: "Cannot revert to previous status" };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { orderNumber },
        data: { status: newStatus },
      });

      // Rollback reservedQty if cancelling
      if (newStatus === "CANCELLED" && order.pickupDate) {
        for (const item of order.items) {
          if (!item.productId) continue;
          const inv = await tx.dailyInventory.findUnique({
            where: { productId_date: { productId: item.productId, date: order.pickupDate } },
          });
          if (inv) {
            await tx.dailyInventory.update({
              where: { productId_date: { productId: item.productId, date: order.pickupDate } },
              data: { reservedQty: Math.max(0, inv.reservedQty - item.quantity) },
            });
          }
        }
      }
    });
    return { success: true };
  } catch (err) {
    console.error("Status update failed:", err);
    return { success: false, message: "Error changing status" };
  }
}
