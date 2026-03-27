export const dynamic = "force-dynamic";

import { requireAuth } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft", PENDING: "Received", CONFIRMED: "Confirmed",
  PREPARING: "Preparing", READY: "Ready", COMPLETED: "Completed", CANCELLED: "Cancelled",
};

export default async function OrderSuccessPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const session = await requireAuth();
  const { orderNumber } = await params;

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: {
        include: { options: true },
      },
    },
  });

  if (!order || order.userId !== session.userId) notFound();

  const pickupDateStr = order.pickupDate
    ? new Intl.DateTimeFormat("en-NZ", { year: "numeric", month: "long", day: "numeric" }).format(new Date(order.pickupDate))
    : "-";

  return (
    <div className="max-w-xl mx-auto py-8 space-y-6 text-center">
      <div>
        <p className="text-5xl mb-3">🎉</p>
        <h1 className="text-2xl font-bold text-gray-900">Your order has been placed!</h1>
        <p className="text-gray-500 mt-2 text-sm">Your order has been received. Please visit on your pickup date.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 text-left space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Order Number</span>
          <span className="font-mono font-semibold text-gray-900">{order.orderNumber}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Status</span>
          <span className="font-medium text-amber-700">{STATUS_LABELS[order.status] ?? order.status}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Pickup Date</span>
          <span className="font-medium text-gray-900">{pickupDateStr}</span>
        </div>
        {order.pickupTimeSlot && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Pickup Time</span>
            <span className="font-medium text-gray-900">{order.pickupTimeSlot}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Total Amount</span>
          <span className="font-bold text-gray-900">${order.totalAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Payment</span>
          <span className="text-gray-700">On-site Payment</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 text-left space-y-2">
        <h2 className="font-semibold text-sm text-gray-800 mb-2">Orders Products</h2>
        {order.items.map((item) => (
          <div key={item.id} className="text-sm">
            <div className="flex justify-between">
              <span className="text-gray-800">{item.productNameSnapshot} × {item.quantity}</span>
              <span className="font-medium">${item.lineTotal.toFixed(2)}</span>
            </div>
            {item.options.length > 0 && (
              <p className="text-xs text-gray-400 ml-2">
                {item.options.map((o) => o.optionNameSnapshot).join(", ")}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <Link href="/account/orders" className="block py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600">
          View My Orders
        </Link>
        <Link href="/order" className="block py-3 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
