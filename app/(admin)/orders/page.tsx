export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import Link from "next/link";
import OrdersTableClient from "./OrdersTableClient";

const currencyFormatter = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
});

export default async function OrdersPage() {
  await requireAdmin();

  const orders = await prisma.customerOrder.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      pickupType: true,
      pickupTime: true,
      notes: true,
      createdAt: true,
      subtotal: true,
      total: true,
      status: true,
      loyverseReceiptId: true,
      loyverseSyncError: true,
      items: {
        select: {
          id: true,
          itemNameSnapshot: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          notes: true,
          modifiers: {
            select: {
              id: true,
              modifierGroupName: true,
              modifierOptionName: true,
              priceDelta: true,
            },
          },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/dashboard" className="transition-colors hover:text-amber-600">
            Dashboard
          </Link>
          <span>/</span>
          <span className="font-medium text-gray-700">Orders</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Customer Orders</h1>
        <p className="mt-1 text-sm text-gray-500">Latest orders first, with status updates and Loyverse retry sync actions.</p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-sm text-gray-600">No customer orders yet.</p>
          <Link
            href="/order"
            className="mt-3 inline-block rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
          >
            Open Ordering Page
          </Link>
        </div>
      ) : (
        <OrdersTableClient
          orders={orders.map((order) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            customerEmail: order.customerEmail,
            pickupType: order.pickupType,
            pickupTimeLabel: order.pickupTime ? order.pickupTime.toLocaleString("en-NZ") : null,
            notes: order.notes,
            createdAtLabel: order.createdAt.toLocaleString("en-NZ"),
            subtotalLabel: currencyFormatter.format(Number(order.subtotal)),
            totalLabel: currencyFormatter.format(Number(order.total)),
            status: order.status,
            loyverseReceiptId: order.loyverseReceiptId,
            loyverseSyncError: order.loyverseSyncError,
            items: order.items.map((item) => ({
              id: item.id,
              itemNameSnapshot: item.itemNameSnapshot,
              quantity: item.quantity,
              unitPriceLabel: currencyFormatter.format(Number(item.unitPrice)),
              totalPriceLabel: currencyFormatter.format(Number(item.totalPrice)),
              notes: item.notes,
              modifiers: item.modifiers.map((modifier) => ({
                id: modifier.id,
                modifierGroupName: modifier.modifierGroupName,
                modifierOptionName: modifier.modifierOptionName,
                priceDeltaLabel: currencyFormatter.format(Number(modifier.priceDelta)),
              })),
            })),
          }))}
        />
      )}
    </div>
  );
}
