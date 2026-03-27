export const dynamic = "force-dynamic";

import { requireAuth } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft", PENDING: "Received", CONFIRMED: "Confirmed",
  PREPARING: "Preparing", READY: "Ready", COMPLETED: "Completed", CANCELLED: "Cancelled",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "text-amber-700 bg-amber-50",
  CONFIRMED: "text-blue-700 bg-blue-50",
  PREPARING: "text-purple-700 bg-purple-50",
  READY: "text-green-700 bg-green-50",
  COMPLETED: "text-gray-600 bg-gray-100",
  CANCELLED: "text-red-600 bg-red-50",
  DRAFT: "text-gray-500 bg-gray-50",
};

export default async function AccountOrdersPage() {
  const session = await requireAuth();

  const orders = await prisma.order.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    select: {
      orderNumber: true,
      status: true,
      pickupDate: true,
      pickupTimeSlot: true,
      totalAmount: true,
      createdAt: true,
    },
  });

  const fmt = new Intl.DateTimeFormat("en-NZ", { year: "numeric", month: "short", day: "numeric" });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/account" className="hover:text-amber-600">My Account</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">My Orders</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">My Orders List</h1>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center space-y-4">
          <p className="text-4xl">📦</p>
          <p className="text-gray-500">No order history yet</p>
          <Link href="/order" className="inline-block px-5 py-2 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600">
            Place an Order
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.orderNumber}
              href={`/account/orders/${order.orderNumber}`}
              className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-amber-300 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-semibold text-gray-900">{order.orderNumber}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{fmt.format(new Date(order.createdAt))}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[order.status] ?? "text-gray-600 bg-gray-100"}`}>
                  {STATUS_LABELS[order.status] ?? order.status}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  Pickup: {order.pickupDate ? fmt.format(new Date(order.pickupDate)) : "-"}
                  {order.pickupTimeSlot && ` ${order.pickupTimeSlot}`}
                </span>
                <span className="font-bold text-gray-900">${order.totalAmount.toFixed(2)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
