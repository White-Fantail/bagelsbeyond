import { requireAuth } from "@/lib/auth/dal";
import { getCustomerSubscriptions } from "@/lib/customer/subscriptions";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-yellow-100 text-yellow-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export default async function SubscriptionsListPage() {
  const session = await requireAuth();
  const subs = await getCustomerSubscriptions(session.userId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">My Subscriptions</h1>
        <Link href="/subscriptions" className="text-xs text-amber-600 hover:underline">+ Add New</Link>
      </div>
      {subs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-2">🔄</div>
          <p>No subscriptions yet</p>
          <Link href="/subscriptions" className="mt-4 inline-block text-sm text-amber-600 hover:underline">Browse plans</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {subs.map(sub => (
            <Link key={sub.id} href={`/account/subscriptions/${sub.id}`}
              className="block bg-white rounded-xl border border-gray-100 p-4 hover:border-amber-200 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900 text-sm capitalize">{sub.frequency.toLowerCase()} subscription</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[sub.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {sub.status}
                </span>
              </div>
              <div className="text-xs text-gray-500">{sub.pickupDays.join(", ")} at {sub.pickupTime} · {sub.itemCount} items</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
