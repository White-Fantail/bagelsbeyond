export const dynamic = "force-dynamic";

import { requireAuth } from "@/lib/auth/dal";
import { getSubscriptionById } from "@/lib/services/subscriptionService";
import { redirect } from "next/navigation";
import Link from "next/link";
import SubscriptionActions from "./SubscriptionActions";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  CANCELLED: "Cancelled",
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "text-green-700 bg-green-50",
  PAUSED: "text-amber-700 bg-amber-50",
  CANCELLED: "text-gray-500 bg-gray-100",
};

const OCC_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Scheduled",
  ORDER_CREATED: "Order Created",
  SKIPPED: "Skipped",
  CANCELLED: "Cancelled",
};

const OCC_STATUS_COLOR: Record<string, string> = {
  SCHEDULED: "text-blue-700 bg-blue-50",
  ORDER_CREATED: "text-green-700 bg-green-50",
  SKIPPED: "text-gray-500 bg-gray-100",
  CANCELLED: "text-red-600 bg-red-50",
};

const fmt = new Intl.DateTimeFormat("en-NZ", { month: "short", day: "numeric" });

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  const { id } = await params;

  const sub = await getSubscriptionById(id, session.userId);
  if (!sub) redirect("/account/subscriptions");

  const now = new Date();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/account" className="hover:text-amber-600">My Account</Link>
          <span>/</span>
          <Link href="/account/subscriptions" className="hover:text-amber-600">My Subscriptions</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Subscription Details</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Subscription Details</h1>
      </div>

      {/* Status & info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[sub.status] ?? "text-gray-600 bg-gray-100"}`}>
            {STATUS_LABEL[sub.status] ?? sub.status}
          </span>
          <span className="font-semibold text-gray-900">Every {WEEKDAYS[sub.pickupWeekday]}</span>
          {sub.pickupTimeSlot && <span className="text-sm text-gray-500">{sub.pickupTimeSlot}</span>}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-500 text-xs">Start Date</p>
            <p className="font-medium">{fmt.format(new Date(sub.startDate))}</p>
          </div>
          {sub.endDate && (
            <div>
              <p className="text-gray-500 text-xs">End Date</p>
              <p className="font-medium">{fmt.format(new Date(sub.endDate))}</p>
            </div>
          )}
        </div>

        {sub.note && (
          <div>
            <p className="text-gray-500 text-xs">Notes</p>
            <p className="text-sm text-gray-700">{sub.note}</p>
          </div>
        )}

        <div>
          <p className="text-gray-500 text-xs mb-1">Subscription Items</p>
          <div className="space-y-1">
            {sub.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.product.name}</span>
                <span className="text-gray-500">×{item.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      {sub.status !== "CANCELLED" && (
        <SubscriptionActions subscriptionId={sub.id} status={sub.status} />
      )}

      {/* Occurrences */}
      {sub.occurrences.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Occurrence History</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {sub.occurrences.map((occ) => (
              <div key={occ.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-gray-700">{fmt.format(new Date(occ.date))}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${OCC_STATUS_COLOR[occ.status] ?? "text-gray-600 bg-gray-100"}`}>
                    {OCC_STATUS_LABEL[occ.status] ?? occ.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {occ.order && (
                    <Link href={`/order/success/${occ.order.orderNumber}`} className="text-xs text-amber-600 hover:underline">
                      {occ.order.orderNumber}
                    </Link>
                  )}
                  {occ.status === "SCHEDULED" && new Date(occ.date) > now && (
                    <SubscriptionActions
                      occurrenceId={occ.id}
                      mode="skip"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
