import "server-only";
import { prisma } from "@/lib/db";

export interface SubscriptionSummary {
  id: string;
  status: string;
  frequency: string;
  pickupDays: string[];
  pickupTime: string;
  startDate: string;
  pausedAt: string | null;
  cancelledAt: string | null;
  itemCount: number;
  createdAt: string;
}

export interface SubscriptionDetail extends SubscriptionSummary {
  note: string | null;
  items: { itemName: string; quantity: number; unitPrice: number }[];
  recentOrders: { id: string; orderNumber: string; pickupDate: string; status: string }[];
}

export async function getCustomerSubscriptions(customerId: string): Promise<SubscriptionSummary[]> {
  const subs = await prisma.subscription.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      frequency: true,
      pickupDays: true,
      pickupTime: true,
      startDate: true,
      pausedAt: true,
      cancelledAt: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });
  return subs.map(s => ({
    id: s.id,
    status: s.status,
    frequency: s.frequency,
    pickupDays: s.pickupDays,
    pickupTime: s.pickupTime,
    startDate: s.startDate.toISOString(),
    pausedAt: s.pausedAt?.toISOString() ?? null,
    cancelledAt: s.cancelledAt?.toISOString() ?? null,
    itemCount: s._count.items,
    createdAt: s.createdAt.toISOString(),
  }));
}

export async function getSubscriptionDetail(subscriptionId: string, customerId: string): Promise<SubscriptionDetail | null> {
  const sub = await prisma.subscription.findFirst({
    where: { id: subscriptionId, customerId },
    select: {
      id: true,
      status: true,
      frequency: true,
      pickupDays: true,
      pickupTime: true,
      startDate: true,
      pausedAt: true,
      cancelledAt: true,
      note: true,
      createdAt: true,
      items: { select: { itemName: true, quantity: true, unitPrice: true } },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, orderNumber: true, pickupDate: true, status: true },
      },
    },
  });
  if (!sub) return null;
  return {
    id: sub.id,
    status: sub.status,
    frequency: sub.frequency,
    pickupDays: sub.pickupDays,
    pickupTime: sub.pickupTime,
    startDate: sub.startDate.toISOString(),
    pausedAt: sub.pausedAt?.toISOString() ?? null,
    cancelledAt: sub.cancelledAt?.toISOString() ?? null,
    note: sub.note,
    createdAt: sub.createdAt.toISOString(),
    itemCount: sub.items.length,
    items: sub.items.map(i => ({
      itemName: i.itemName,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
    })),
    recentOrders: sub.orders.map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      pickupDate: o.pickupDate.toISOString(),
      status: o.status,
    })),
  };
}
