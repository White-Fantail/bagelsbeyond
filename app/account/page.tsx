import { requireAuth } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function AccountPage() {
  const session = await requireAuth();

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!user) {
    return (
      <div className="text-center py-12 text-gray-500">Unable to load user information.</div>
    );
  }

  const roleLabel: Record<string, string> = {
    ADMIN: "Admin",
    STAFF: "Staff",
    CUSTOMER: "Customer",
  };

  const joinedAt = new Intl.DateTimeFormat("en-NZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(user.createdAt));

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
        <p className="text-gray-500 mt-1">Manage your account information and settings</p>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-2xl font-bold text-amber-700">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user.name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>

        <hr className="border-gray-100" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Role</p>
            <p className="font-medium text-gray-900 mt-0.5">
              {roleLabel[user.role] ?? user.role}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Status</p>
            <p className={`font-medium mt-0.5 ${user.isActive ? "text-green-600" : "text-red-500"}`}>
              {user.isActive ? "Active" : "Inactive"}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-gray-500">Join Date</p>
            <p className="font-medium text-gray-900 mt-0.5">{joinedAt}</p>
          </div>
        </div>

        <hr className="border-gray-100" />

        <div className="flex flex-wrap gap-2">
          <Link
            href="/account/profile"
            className="text-sm px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors font-medium"
          >
            Edit Profile
          </Link>
          <Link
            href="/account/security"
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors font-medium"
          >
            Change Password
          </Link>
        </div>
      </div>

      {/* Future feature sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Orders */}
        <Link href="/account/orders" className="block bg-white rounded-xl border border-amber-200 p-5 hover:border-amber-400 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">📦</span>
            <h2 className="font-semibold text-gray-900">My Orders</h2>
          </div>
          <p className="text-sm text-gray-500">View your order history and status.</p>
          <p className="mt-3 text-xs text-amber-600 font-medium">View Orders →</p>
        </Link>

        {/* Subscriptions */}
        <Link href="/account/subscriptions" className="block bg-white rounded-xl border border-amber-200 p-5 hover:border-amber-400 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🔄</span>
            <h2 className="font-semibold text-gray-900">My Subscriptions</h2>
          </div>
          <p className="text-sm text-gray-500">Manage your recurring subscriptions and plans.</p>
          <p className="mt-3 text-xs text-amber-600 font-medium">View Subscriptions →</p>
        </Link>

        {/* Pickup / Contact */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">📍</span>
            <h2 className="font-semibold text-gray-900">Pickup Info</h2>
          </div>
          <p className="text-sm text-gray-500">Manage your saved pickup notes and contact info.</p>
          <p className="mt-3 text-xs text-amber-600 font-medium">Coming soon</p>
        </div>

        {/* Payment */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">💳</span>
            <h2 className="font-semibold text-gray-900">Payment Method</h2>
          </div>
          <p className="text-sm text-gray-500">View and manage your registered payment methods.</p>
          <p className="mt-3 text-xs text-amber-600 font-medium">Coming soon</p>
        </div>
      </div>
    </div>
  );
}
