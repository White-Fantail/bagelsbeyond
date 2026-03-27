import { prisma } from "@/lib/db";
import { SubscriptionStatus, OccurrenceStatus, OrderSource, FulfillmentType, OrderStatus } from "@/app/generated/prisma/enums";
import { generateOrderNumber } from "@/lib/order/order-number";

export interface CreateSubscriptionItemInput {
  productId: string;
  quantity: number;
}

export interface CreateSubscriptionInput {
  userId: string;
  pickupWeekday: number;
  pickupTimeSlot?: string;
  startDate: Date;
  endDate?: Date;
  note?: string;
  items: CreateSubscriptionItemInput[];
}

export async function createSubscription(input: CreateSubscriptionInput) {
  return prisma.subscription.create({
    data: {
      userId: input.userId,
      pickupWeekday: input.pickupWeekday,
      pickupTimeSlot: input.pickupTimeSlot,
      startDate: input.startDate,
      endDate: input.endDate,
      note: input.note,
      items: {
        create: input.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
      },
    },
    include: { items: true },
  });
}

export async function getUserSubscriptions(userId: string) {
  return prisma.subscription.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, basePrice: true } } },
      },
    },
  });
}

export async function getSubscriptionById(id: string, userId?: string) {
  const sub = await prisma.subscription.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      items: {
        include: { product: { select: { id: true, name: true, basePrice: true } } },
      },
      occurrences: {
        orderBy: { date: "desc" },
        take: 10,
        include: { order: { select: { orderNumber: true, status: true } } },
      },
    },
  });

  if (!sub) return null;
  if (userId && sub.userId !== userId) return null;
  return sub;
}

export async function updateSubscriptionStatus(
  id: string,
  status: SubscriptionStatus,
  userId?: string
) {
  const sub = await prisma.subscription.findUnique({ where: { id } });
  if (!sub) throw new Error("Subscription not found");
  if (userId && sub.userId !== userId) throw new Error("Access unauthorized");

  return prisma.subscription.update({
    where: { id },
    data: { status },
  });
}

export async function generateOccurrencesForDate(date: Date) {
  const weekday = date.getUTCDay();
  const dateOnly = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      pickupWeekday: weekday,
      startDate: { lte: dateOnly },
      OR: [{ endDate: null }, { endDate: { gte: dateOnly } }],
    },
  });

  let created = 0;
  await prisma.$transaction(async (tx) => {
    for (const sub of subscriptions) {
      const existing = await tx.subscriptionOccurrence.findUnique({
        where: { subscriptionId_date: { subscriptionId: sub.id, date: dateOnly } },
      });
      if (existing) continue;
      await tx.subscriptionOccurrence.create({
        data: { subscriptionId: sub.id, date: dateOnly, status: OccurrenceStatus.SCHEDULED },
      });
      created++;
    }
  });

  return { created, total: subscriptions.length };
}

export async function generateOrdersFromOccurrences(date: Date) {
  const dateOnly = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  const occurrences = await prisma.subscriptionOccurrence.findMany({
    where: { date: dateOnly, status: OccurrenceStatus.SCHEDULED },
    include: {
      subscription: {
        include: {
          items: {
            include: { product: true },
          },
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  let ordersCreated = 0;

  for (const occ of occurrences) {
    const { subscription } = occ;
    if (!subscription.items.length) continue;

    const subtotal = subscription.items.reduce(
      (s, i) => s + i.product.basePrice * i.quantity,
      0
    );

    let orderNumber = generateOrderNumber();
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await prisma.order.findUnique({ where: { orderNumber } });
      if (!existing) break;
      orderNumber = generateOrderNumber();
    }

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: subscription.userId,
          source: OrderSource.SUBSCRIPTION,
          status: OrderStatus.PENDING,
          fulfillmentType: FulfillmentType.PICKUP,
          pickupDate: dateOnly,
          pickupTimeSlot: subscription.pickupTimeSlot,
          customerNameSnapshot: subscription.user.name,
          customerEmailSnapshot: subscription.user.email,
          subtotalAmount: subtotal,
          discountAmount: 0,
          totalAmount: subtotal,
          note: subscription.note,
          items: {
            create: subscription.items.map((item) => ({
              productId: item.productId,
              productNameSnapshot: item.product.name,
              unitPriceSnapshot: item.product.basePrice,
              quantity: item.quantity,
              lineTotal: item.product.basePrice * item.quantity,
            })),
          },
        },
      });

      await tx.subscriptionOccurrence.update({
        where: { id: occ.id },
        data: { status: OccurrenceStatus.ORDER_CREATED, orderId: order.id },
      });

      for (const item of subscription.items) {
        await tx.dailyInventory.upsert({
          where: { productId_date: { productId: item.productId, date: dateOnly } },
          update: { reservedQty: { increment: item.quantity } },
          create: {
            productId: item.productId,
            date: dateOnly,
            plannedQty: 0,
            bakedQty: 0,
            reservedQty: item.quantity,
            soldQty: 0,
            isSoldOut: false,
          },
        });
      }
    });

    ordersCreated++;
  }

  return { ordersCreated, total: occurrences.length };
}

export async function skipOccurrence(occurrenceId: string, userId?: string) {
  const occ = await prisma.subscriptionOccurrence.findUnique({
    where: { id: occurrenceId },
    include: { subscription: { select: { userId: true } } },
  });

  if (!occ) throw new Error("Occurrence not found");
  if (userId && occ.subscription.userId !== userId) throw new Error("Access unauthorized");
  if (occ.status !== OccurrenceStatus.SCHEDULED) throw new Error("Only SCHEDULED status items can be skipped");

  return prisma.subscriptionOccurrence.update({
    where: { id: occurrenceId },
    data: { status: OccurrenceStatus.SKIPPED },
  });
}

export async function cancelOccurrence(occurrenceId: string) {
  const occ = await prisma.subscriptionOccurrence.findUnique({
    where: { id: occurrenceId },
    include: {
      order: {
        include: { items: { select: { productId: true, quantity: true } } },
      },
      subscription: { select: { userId: true } },
    },
  });

  if (!occ) throw new Error("Occurrence not found");

  await prisma.$transaction(async (tx) => {
    if (occ.status === OccurrenceStatus.ORDER_CREATED && occ.orderId && occ.order) {
      await tx.order.update({
        where: { id: occ.orderId },
        data: { status: OrderStatus.CANCELLED },
      });

      for (const item of occ.order.items) {
        if (!item.productId) continue;
        const inv = await tx.dailyInventory.findUnique({
          where: { productId_date: { productId: item.productId, date: occ.date } },
        });
        if (inv) {
          await tx.dailyInventory.update({
            where: { productId_date: { productId: item.productId, date: occ.date } },
            data: { reservedQty: Math.max(0, inv.reservedQty - item.quantity) },
          });
        }
      }
    }

    await tx.subscriptionOccurrence.update({
      where: { id: occurrenceId },
      data: { status: OccurrenceStatus.CANCELLED },
    });
  });
}

export async function getSubscriptionSummaryForDate(date: Date) {
  const weekday = date.getUTCDay();
  const dateOnly = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  const occurrences = await prisma.subscriptionOccurrence.findMany({
    where: { date: dateOnly },
    include: {
      subscription: {
        include: {
          items: { include: { product: { select: { id: true, name: true } } } },
        },
      },
    },
  });

  if (occurrences.length > 0) {
    const summaryMap = new Map<string, { productId: string; productName: string; totalQty: number }>();
    for (const occ of occurrences) {
      if (occ.status === OccurrenceStatus.CANCELLED || occ.status === OccurrenceStatus.SKIPPED) continue;
      for (const item of occ.subscription.items) {
        const existing = summaryMap.get(item.productId);
        if (existing) {
          existing.totalQty += item.quantity;
        } else {
          summaryMap.set(item.productId, {
            productId: item.productId,
            productName: item.product.name,
            totalQty: item.quantity,
          });
        }
      }
    }
    return Array.from(summaryMap.values());
  }

  // Fall back to active subscriptions matching weekday
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      pickupWeekday: weekday,
      startDate: { lte: dateOnly },
      OR: [{ endDate: null }, { endDate: { gte: dateOnly } }],
    },
    include: {
      items: { include: { product: { select: { id: true, name: true } } } },
    },
  });

  const summaryMap = new Map<string, { productId: string; productName: string; totalQty: number }>();
  for (const sub of subscriptions) {
    for (const item of sub.items) {
      const existing = summaryMap.get(item.productId);
      if (existing) {
        existing.totalQty += item.quantity;
      } else {
        summaryMap.set(item.productId, {
          productId: item.productId,
          productName: item.product.name,
          totalQty: item.quantity,
        });
      }
    }
  }
  return Array.from(summaryMap.values());
}

export async function generateNext7DaysOccurrences() {
  const results = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + i);
    const result = await generateOccurrencesForDate(date);
    results.push({ date: date.toISOString().slice(0, 10), ...result });
  }
  return results;
}
