import { requireAuth } from "@/lib/auth/dal";
import { getCustomerOrderDetail } from "@/lib/customer/orders";
import { notFound } from "next/navigation";
import Link from "next/link";

interface PageProps { params: Promise<{ orderId: string }> }

export default async function OrderDetailPage({ params }: PageProps) {
  const { orderId } = await params;
  const session = await requireAuth();
  const order = await getCustomerOrderDetail(orderId, session.userId);
  if (!order) notFound();

  return (
    <div className="space-y-4">
      <Link href="/account/orders" className="text-xs text-amber-600 hover:underline">← Back to orders</Link>
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-gray-900">{order.orderNumber}</h1>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{order.status}</span>
        </div>
        <div className="text-sm text-gray-500">Pickup: {new Date(order.pickupDate).toLocaleDateString("en-NZ")} at {order.pickupTime}</div>
        {order.note && <p className="text-sm text-gray-500 italic">{order.note}</p>}
        <hr className="border-gray-100" />
        <div className="space-y-2">
          {order.lines.map(line => (
            <div key={line.id} className="flex justify-between text-sm">
              <div>
                <span className="font-medium text-gray-900">{line.itemName}</span>
                {line.modifiers.length > 0 && (
                  <p className="text-xs text-gray-400">{line.modifiers.map(m => m.optionName).join(", ")}</p>
                )}
                <span className="text-xs text-gray-400"> × {line.quantity}</span>
              </div>
              <span className="font-medium text-gray-900">${line.lineTotal.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <hr className="border-gray-100" />
        <div className="flex justify-between font-bold text-gray-900">
          <span>Total</span><span>${order.total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
