import { getCustomerOrderDetail } from "@/lib/customer/orders";
import { requireAuth } from "@/lib/auth/dal";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ orderId: string }>;
}

export default async function OrderSuccessPage({ params }: PageProps) {
  const { orderId } = await params;
  const session = await requireAuth();
  const order = await getCustomerOrderDetail(orderId, session.userId);
  if (!order) notFound();

  return (
    <div className="text-center py-8 space-y-4">
      <div className="text-5xl">🎉</div>
      <h1 className="text-xl font-bold text-gray-900">Order Placed!</h1>
      <p className="text-gray-500 text-sm">Your order has been received.</p>
      <div className="bg-white rounded-xl border border-gray-100 p-4 text-left space-y-2 mt-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Order #</span>
          <span className="font-semibold text-gray-900">{order.orderNumber}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Pickup</span>
          <span className="font-medium text-gray-900">
            {new Date(order.pickupDate).toLocaleDateString("en-NZ")} at {order.pickupTime}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Total</span>
          <span className="font-bold text-amber-700">${order.total.toFixed(2)}</span>
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <Link href="/account/orders" className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 text-center">
          View Orders
        </Link>
        <Link href="/menu" className="flex-1 py-3 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 text-center">
          Back to Menu
        </Link>
      </div>
    </div>
  );
}
