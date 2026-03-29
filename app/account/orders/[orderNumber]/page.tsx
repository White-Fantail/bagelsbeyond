export const dynamic = "force-dynamic";

import { requireAuth } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import CancelOrderButton from "./CancelOrderButton";

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

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const session = await requireAuth();
  const { orderNumber } = await params;

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: { include: { options: true } },
    },
  });

  if (!order || order.userId !== session.userId) notFound();

  const fmt = new Intl.DateTimeFormat("en-NZ", { year: "numeric", month: "long", day: "numeric" });
  const canCancel = order.status === "PENDING" || order.status === "CONFIRMED";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/account" className="hover:text-amber-600">My Account</Link>
          <span>/</span>
          <Link href="/account/orders" className="hover:text-amber-600">My Orders</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">{order.orderNumber}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Order Details</h1>
      </div>

      {/* Order info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="flex justify-between items-center">
          <span className="font-mono font-semibold text-gray-900">{order.orderNumber}</span>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[order.status] ?? "text-gray-600 bg-gray-100"}`}>
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>
        <hr className="border-gray-100" />
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-500">Pickup Date</p>
            <p className="font-medium">{order.pickupDate ? fmt.format(new Date(order.pickupDate)) : "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">Pickup Time</p>
            <p className="font-medium">{order.pickupTimeSlot ?? "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">Payment Status</p>
            <p className="font-medium">{order.paymentStatus === "UNPAID" ? "On-site payment" : order.paymentStatus}</p>
          </div>
          <div>
            <p className="text-gray-500">Order Date</p>
            <p className="font-medium">{fmt.format(new Date(order.createdAt))}</p>
          </div>
        </div>
        {order.note && (
          <div className="text-sm">
            <p className="text-gray-500">Notes</p>
            <p className="text-gray-800">{order.note}</p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="font-semibold text-gray-900">Order Items</h2>
        {order.items.map((item) => (
          <div key={item.id} className="text-sm space-y-0.5">
            <div className="flex justify-between">
              <span className="text-gray-800 font-medium">{item.productNameSnapshot} × {item.quantity}</span>
              <span className="font-bold">${item.lineTotal.toFixed(2)}</span>
            </div>
            {item.options.length > 0 && (
              <p className="text-xs text-gray-500 ml-2">
                {item.options.map((o) => `${o.optionNameSnapshot}${o.priceDeltaSnapshot !== 0 ? ` (+$${o.priceDeltaSnapshot.toFixed(2)})` : ""}`).join(", ")}
              </p>
            )}
          </div>
        ))}
        <hr className="border-gray-100" />
        <div className="flex justify-between font-bold text-gray-900">
          <span>Total</span>
          <span>${order.totalAmount.toFixed(2)}</span>
        </div>
      </div>

      {canCancel && <CancelOrderButton orderNumber={order.orderNumber} />}
    </div>
  );
}
