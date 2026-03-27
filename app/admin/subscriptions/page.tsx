export const dynamic = "force-dynamic";

import { requireStaffOrAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import Link from "next/link";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  PAUSED: "Pause",
  CANCELLED: "Cancelled",
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "text-green-700 bg-green-50",
  PAUSED: "text-amber-700 bg-amber-50",
  CANCELLED: "text-gray-500 bg-gray-100",
};

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; userId?: string }>;
}) {
  await requireStaffOrAdmin();
  const { status, userId } = await searchParams;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (userId) where.userId = userId;

  const subscriptions = await prisma.subscription.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { id: true, name: true, email: true } },
      items: {
        include: { product: { select: { id: true, name: true } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/admin" className="hover:text-amber-600">Admin Dashboard</Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">Manage Subscriptions</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Subscriptions</h1>
          <p className="text-gray-500 text-sm mt-0.5">View all subscriptions (STAFF and above)</p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 bg-white rounded-xl border border-gray-200 p-4">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="">All Status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button type="submit" className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600">
          Search
        </button>
        <Link href="/admin/subscriptions" className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
          Reset
        </Link>
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {subscriptions.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No results matching your filters No subscriptions yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Day</th>
                  <th className="px-4 py-3 text-left">Products</th>
                  <th className="px-4 py-3 text-left">Start Date</th>
                  <th className="px-4 py-3 text-left">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{sub.user.name}</p>
                      <p className="text-xs text-gray-400">{sub.user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[sub.status] ?? "text-gray-600 bg-gray-100"}`}>
                        {STATUS_LABEL[sub.status] ?? sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      Every {WEEKDAYS[sub.pickupWeekday]}Day
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {sub.items.map((i) => `${i.product.name}×${i.quantity}`).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(sub.startDate).toLocaleDateString("en-NZ")}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/subscriptions/${sub.id}`} className="text-amber-600 hover:underline text-xs">
                        Details →
                      </Link>
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
