import { requireAuth } from "@/lib/auth/dal";
import { getCustomerOrders } from "@/lib/customer/orders";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  READY: "bg-green-100 text-green-700",
  COMPLETED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-600",
};

export default async function OrdersPage() {
  const session = await requireAuth();
  const orders = await getCustomerOrders(session.userId);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">My Orders</h1>
      {orders.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-2">📦</div>
          <p>No orders yet</p>
          <Link href="/menu" className="mt-4 inline-block text-sm text-amber-600 hover:underline">Browse Menu</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <Link key={order.id} href={`/account/orders/${order.id}`}
              className="block bg-white rounded-xl border border-gray-100 p-4 hover:border-amber-200 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900 text-sm">{order.orderNumber}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {order.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{new Date(order.pickupDate).toLocaleDateString("en-NZ")} at {order.pickupTime}</span>
                <span className="font-bold text-amber-700">${order.total.toFixed(2)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
