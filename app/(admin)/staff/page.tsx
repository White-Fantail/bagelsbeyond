import { requireStaffOrAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function StaffPage() {
  const session = await requireStaffOrAdmin();

  const recentRecords = await prisma.dailyRecord.findMany({
    orderBy: { date: "desc" },
    take: 5,
    select: { id: true, date: true, storeSales: true, uberSales: true, doordashSales: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Staff Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Hello, {session.name} ({session.role})
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/sales/new"
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-5 hover:bg-amber-100 transition-colors"
        >
          <span className="text-2xl">➕</span>
          <div>
            <p className="font-semibold text-amber-800">Enter Sales</p>
            <p className="text-xs text-amber-600">Today Sales Records Add</p>
          </div>
        </Link>
        <Link
          href="/predictions/new"
          className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-5 hover:bg-blue-100 transition-colors"
        >
          <span className="text-2xl">📊</span>
          <div>
            <p className="font-semibold text-blue-800">Predictions Create</p>
            <p className="text-xs text-blue-600">Tomorrow Sold Predictions Run</p>
          </div>
        </Link>
      </div>

      {/* Recent records */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">recent Sales Records</h2>
        {recentRecords.length === 0 ? (
          <p className="text-sm text-gray-500">No records.</p>
        ) : (
          <div className="space-y-2">
            {recentRecords.map((r) => (
              <Link
                key={r.id}
                href={`/sales/${r.id}`}
                className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-gray-50 text-sm"
              >
                <span className="text-gray-700">
                  {new Date(r.date).toLocaleDateString("en-NZ")}
                </span>
                <span className="font-medium text-gray-900">
                  ${(r.storeSales + r.uberSales + r.doordashSales).toFixed(0)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
