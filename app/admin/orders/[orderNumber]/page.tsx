export const dynamic = "force-dynamic";

import { requireStaffOrAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import OrderStatusChanger from "./OrderStatusChanger";

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

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  await requireStaffOrAdmin();
  const { orderNumber } = await params;

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: { include: { options: true } },
      externalMapping: true,
    },
  });

  if (!order) notFound();

  const fmt = new Intl.DateTimeFormat("en-NZ", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/admin" className="hover:text-amber-600">Admin</Link>
          <span>/</span>
          <Link href="/admin/orders" className="hover:text-amber-600">Order Management</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">{order.orderNumber}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Orders Details (Admin)</h1>
      </div>

      {/* Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-mono font-semibold text-gray-900">{order.orderNumber}</span>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[order.status] ?? "text-gray-600 bg-gray-100"}`}>
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>
        <OrderStatusChanger orderNumber={order.orderNumber} currentStatus={order.status} />
      </div>

      {/* Customer + pickup info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">Orders Info</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-500">Customer Name</p>
            <p className="font-medium">{order.customerNameSnapshot ?? "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">Email</p>
            <p className="font-medium">{order.customerEmailSnapshot ?? "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">Phone</p>
            <p className="font-medium">{order.customerPhoneSnapshot ?? "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">Source</p>
            <p className="font-medium">{order.source}</p>
          </div>
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
            <p className="font-medium">{order.paymentStatus}</p>
          </div>
          <div>
            <p className="text-gray-500">Order Date</p>
            <p className="font-medium">{fmt.format(new Date(order.createdAt))}</p>
          </div>
        </div>
        {order.note && (
          <div className="text-sm">
            <p className="text-gray-500">Notes</p>
            <p className="text-gray-800 bg-gray-50 rounded-lg p-2">{order.note}</p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">Orders Products</h2>
        {order.items.map((item) => (
          <div key={item.id} className="text-sm space-y-0.5">
            <div className="flex justify-between">
              <span className="font-medium text-gray-800">{item.productNameSnapshot} × {item.quantity}</span>
              <span className="font-bold">${item.lineTotal.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-500">Unit price: ${item.unitPriceSnapshot.toFixed(2)}</p>
            {item.options.length > 0 && (
              <p className="text-xs text-gray-400 ml-2">
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

      {/* POS integration placeholder */}
      <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
        <p className="font-medium text-gray-700 mb-1">🔌 External POS Send (coming soon)</p>
        {order.externalMapping ? (
          <p>External ID: {order.externalMapping.externalOrderId} | Status: {order.externalMapping.syncStatus}</p>
        ) : (
          <p>Not yet sent to External POS. This will be available here after Loyverse integration is set up.</p>
        )}
      </div>
    </div>
  );
}
