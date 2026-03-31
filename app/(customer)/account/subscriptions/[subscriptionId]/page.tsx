import { requireAuth } from "@/lib/auth/dal";
import { getSubscriptionDetail } from "@/lib/customer/subscriptions";
import { notFound } from "next/navigation";
import Link from "next/link";
import SubscriptionActions from "./subscription-actions";

interface PageProps { params: Promise<{ subscriptionId: string }> }

export default async function SubscriptionDetailPage({ params }: PageProps) {
  const { subscriptionId } = await params;
  const session = await requireAuth();
  const sub = await getSubscriptionDetail(subscriptionId, session.userId);
  if (!sub) notFound();

  return (
    <div className="space-y-4">
      <Link href="/account/subscriptions" className="text-xs text-amber-600 hover:underline">← Back to subscriptions</Link>
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-gray-900 capitalize">{sub.frequency.toLowerCase()} subscription</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sub.status === "ACTIVE" ? "bg-green-100 text-green-700" : sub.status === "PAUSED" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
            {sub.status}
          </span>
        </div>
        <div className="text-sm text-gray-600 space-y-1">
          <p>Days: {sub.pickupDays.join(", ")} at {sub.pickupTime}</p>
          <p>Started: {new Date(sub.startDate).toLocaleDateString("en-NZ")}</p>
        </div>
        <hr className="border-gray-100" />
        <div className="space-y-1">
          {sub.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-gray-700">{item.itemName} × {item.quantity}</span>
              <span className="text-gray-500">${(item.unitPrice * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>
        {sub.status !== "CANCELLED" && (
          <SubscriptionActions subscriptionId={sub.id} status={sub.status} />
        )}
      </div>
    </div>
  );
}
