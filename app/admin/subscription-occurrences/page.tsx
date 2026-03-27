export const dynamic = "force-dynamic";

import { requireStaffOrAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import Link from "next/link";
import OccurrencesAdminActions from "./OccurrencesAdminActions";

const OCC_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Scheduled",
  ORDER_CREATED: "OrdersCreate",
  SKIPPED: "Skipped",
  CANCELLED: "Cancelled",
};

const OCC_STATUS_COLOR: Record<string, string> = {
  SCHEDULED: "text-blue-700 bg-blue-50",
  ORDER_CREATED: "text-green-700 bg-green-50",
  SKIPPED: "text-gray-500 bg-gray-100",
  CANCELLED: "text-red-600 bg-red-50",
};

export default async function AdminSubscriptionOccurrencesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireStaffOrAdmin();
  const { date } = await searchParams;

  const today = new Date().toISOString().slice(0, 10);
  const selectedDate = date ?? today;

  let occurrences: Array<{
    id: string;
    date: Date;
    status: string;
    subscription: {
      id: string;
      pickupWeekday: number;
      user: { name: string; email: string };
      items: Array<{ quantity: number; product: { name: string } }>;
    };
    order: { orderNumber: string; status: string } | null;
  }> = [];

  if (selectedDate) {
    const dateObj = new Date(selectedDate + "T00:00:00.000Z");
    occurrences = await prisma.subscriptionOccurrence.findMany({
      where: { date: dateObj },
      orderBy: { createdAt: "asc" },
      include: {
        subscription: {
          include: {
            user: { select: { name: true, email: true } },
            items: { include: { product: { select: { name: true } } } },
          },
        },
        order: { select: { orderNumber: true, status: true } },
      },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/admin" className="hover:text-amber-600">Admin Dashboard</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Subscription Occurrence Management</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Subscription Occurrence Management</h1>
        <p className="text-gray-500 text-sm mt-0.5">View subscription occurrences by date and create orders (STAFF and above)</p>
      </div>

      {/* Date filter + actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <form method="GET" className="flex gap-3 flex-wrap">
          <input
            type="date"
            name="date"
            defaultValue={selectedDate}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button type="submit" className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600">
            View
          </button>
        </form>

        <OccurrencesAdminActions date={selectedDate} />
      </div>

      {/* Occurrences list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {occurrences.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No subscription occurrences for this date</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Products</th>
                  <th className="px-4 py-3 text-left">Order Number</th>
                  <th className="px-4 py-3 text-left">Task</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {occurrences.map((occ) => (
                  <tr key={occ.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{occ.subscription.user.name}</p>
                      <p className="text-xs text-gray-400">{occ.subscription.user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${OCC_STATUS_COLOR[occ.status] ?? "text-gray-600 bg-gray-100"}`}>
                        {OCC_STATUS_LABEL[occ.status] ?? occ.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {occ.subscription.items.map((i) => `${i.product.name}×${i.quantity}`).join(", ")}
                    </td>
                    <td className="px-4 py-3">
                      {occ.order ? (
                        <Link href={`/admin/orders/${occ.order.orderNumber}`} className="text-xs text-amber-600 hover:underline">
                          {occ.order.orderNumber}
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <OccurrencesAdminActions occurrenceId={occ.id} status={occ.status} date={selectedDate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
