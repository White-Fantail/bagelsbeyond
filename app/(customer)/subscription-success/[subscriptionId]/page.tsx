import { getSubscriptionDetail } from "@/lib/customer/subscriptions";
import { requireAuth } from "@/lib/auth/dal";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ subscriptionId: string }>;
}

export default async function SubscriptionSuccessPage({ params }: PageProps) {
  const { subscriptionId } = await params;
  const session = await requireAuth();
  const sub = await getSubscriptionDetail(subscriptionId, session.userId);
  if (!sub) notFound();

  return (
    <div className="text-center py-8 space-y-4">
      <div className="text-5xl">🔄</div>
      <h1 className="text-xl font-bold text-gray-900">Subscription Active!</h1>
      <p className="text-gray-500 text-sm">Your subscription has been set up successfully.</p>
      <div className="bg-white rounded-xl border border-gray-100 p-4 text-left space-y-2 mt-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Frequency</span>
          <span className="font-semibold text-gray-900 capitalize">{sub.frequency.toLowerCase()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Pickup Days</span>
          <span className="font-medium text-gray-900">{sub.pickupDays.join(", ")}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Start Date</span>
          <span className="font-medium text-gray-900">
            {new Date(sub.startDate).toLocaleDateString("en-NZ")}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Items</span>
          <span className="font-medium text-gray-900">{sub.itemCount}</span>
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <Link href="/account/subscriptions" className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 text-center">
          My Subscriptions
        </Link>
        <Link href="/menu" className="flex-1 py-3 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 text-center">
          Back to Menu
        </Link>
      </div>
    </div>
  );
}
