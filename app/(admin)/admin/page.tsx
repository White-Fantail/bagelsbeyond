import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function AdminPage() {
  const session = await requireAdmin();

  const [userCount, recordCount] = await Promise.all([
    prisma.user.count(),
    prisma.dailyRecord.count(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Hello, {session.name} (ADMIN)</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">All Users</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{userCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Sales Records</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{recordCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="font-semibold text-gray-900">Admin Only Menu</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <Link href="/admin/users" className="text-amber-600 hover:underline">
              → Users (Change Role &amp; Active Status)
            </Link>
          </li>
          <li>
            <Link href="/analytics" className="text-amber-600 hover:underline">
              → All Sales Analytics (ADMIN only)
            </Link>
          </li>
          <li>
            <Link href="/sales" className="text-amber-600 hover:underline">
              → Sales List
            </Link>
          </li>
          <li>
            <Link href="/weights" className="text-amber-600 hover:underline">
              → Weights Management
            </Link>
          </li>
          <li>
            <Link href="/settings" className="text-amber-600 hover:underline">
              → App Settings
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
