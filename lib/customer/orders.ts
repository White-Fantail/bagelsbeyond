import "server-only";
import { prisma } from "@/lib/db";

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  origin: string;
  pickupDate: string;
  pickupTime: string;
  total: number;
  itemCount: number;
  createdAt: string;
}

export interface OrderDetail extends OrderSummary {
  subtotal: number;
  note: string | null;
  lines: OrderLineDetail[];
}

export interface OrderLineDetail {
  id: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  modifiers: { optionName: string; priceDelta: number }[];
}

export async function getCustomerOrders(customerId: string): Promise<OrderSummary[]> {
  const orders = await prisma.order.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      origin: true,
      pickupDate: true,
      pickupTime: true,
      total: true,
      createdAt: true,
      _count: { select: { lines: true } },
    },
  });
  return orders.map(o => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    origin: o.origin,
    pickupDate: o.pickupDate.toISOString(),
    pickupTime: o.pickupTime,
    total: Number(o.total),
    itemCount: o._count.lines,
    createdAt: o.createdAt.toISOString(),
  }));
}

export async function getCustomerOrderDetail(orderId: string, customerId: string): Promise<OrderDetail | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      origin: true,
      pickupDate: true,
      pickupTime: true,
      subtotal: true,
      total: true,
      note: true,
      createdAt: true,
      lines: {
        select: {
          id: true,
          itemName: true,
          unitPrice: true,
          quantity: true,
          lineTotal: true,
          modifiers: { select: { optionName: true, priceDelta: true } },
        },
      },
    },
  });
  if (!order) return null;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    origin: order.origin,
    pickupDate: order.pickupDate.toISOString(),
    pickupTime: order.pickupTime,
    subtotal: Number(order.subtotal),
    total: Number(order.total),
    note: order.note,
    createdAt: order.createdAt.toISOString(),
    itemCount: order.lines.length,
    lines: order.lines.map(l => ({
      id: l.id,
      itemName: l.itemName,
      unitPrice: Number(l.unitPrice),
      quantity: l.quantity,
      lineTotal: Number(l.lineTotal),
      modifiers: l.modifiers.map(m => ({
        optionName: m.optionName,
        priceDelta: Number(m.priceDelta),
      })),
    })),
  };
}
