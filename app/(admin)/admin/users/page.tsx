export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { Role } from "@/app/generated/prisma/enums";
import { Suspense } from "react";
import Link from "next/link";
import UserFilters from "./UserFilters";
import UserTable from "./UserTable";

type SearchParams = {
  search?: string;
  role?: string;
  isActive?: string;
  sort?: string;
};

async function getUsersData(sp: SearchParams) {
  const search = sp.search?.trim() ?? "";
  const roleFilter = sp.role ?? "ALL";
  const activeFilter = sp.isActive ?? "ALL";
  const sort = sp.sort ?? "createdAt_desc";

  const searchWhere = search
    ? { OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
      ] }
    : {};

  const roleWhere =
    roleFilter !== "ALL" && Object.values(Role).includes(roleFilter as Role)
      ? { role: roleFilter as Role }
      : {};

  const activeWhere =
    activeFilter === "ACTIVE"
      ? { isActive: true }
      : activeFilter === "INACTIVE"
      ? { isActive: false }
      : {};

  const where = { ...searchWhere, ...roleWhere, ...activeWhere };

  type OrderBy = { createdAt: "asc" | "desc" } | { email: "asc" | "desc" } | { name: "asc" | "desc" };
  const orderByMap: Record<string, OrderBy> = {
    email_asc: { email: "asc" },
    email_desc: { email: "desc" },
    name_asc: { name: "asc" },
    createdAt_asc: { createdAt: "asc" },
    createdAt_desc: { createdAt: "desc" },
  };
  const orderBy: OrderBy = orderByMap[sort] ?? { createdAt: "desc" };

  const [users, total, adminCount, staffCount, customerCount, inactiveCount] =
    await Promise.all([
      prisma.user.findMany({
        where,
        orderBy,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count(),
      prisma.user.count({ where: { role: Role.ADMIN } }),
      prisma.user.count({ where: { role: Role.STAFF } }),
      prisma.user.count({ where: { role: Role.CUSTOMER } }),
      prisma.user.count({ where: { isActive: false } }),
    ]);

  return {
    users: users.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    })),
    summary: { total, adminCount, staffCount, customerCount, inactiveCount },
  };
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireAdmin();
  const sp = await searchParams;
  const { users, summary } = await getUsersData(sp);

  const hasFilters = !!(sp.search || sp.role || sp.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/dashboard" className="hover:text-amber-600 transition-colors">
              Operations Dashboard
            </Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">Users</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 mt-0.5 text-sm">Manage all users, their roles and active status</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">All Users</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-100 p-4">
          <p className="text-xs text-red-500">ADMIN</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{summary.adminCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-100 p-4">
          <p className="text-xs text-blue-500">STAFF</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{summary.staffCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">CUSTOMER</p>
          <p className="text-2xl font-bold text-gray-700 mt-1">{summary.customerCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-orange-100 p-4">
          <p className="text-xs text-orange-500">Inactive</p>
          <p className="text-2xl font-bold text-orange-700 mt-1">{summary.inactiveCount}</p>
        </div>
      </div>

      {/* Filters */}
      <Suspense fallback={null}>
        <UserFilters />
      </Suspense>

      {/* Results info */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {hasFilters ? (
            <>
              Search results <strong className="text-gray-700">{users.length}</strong>
              <span className="text-gray-400"> (All {summary.total})</span>
            </>
          ) : (
            <>
              All <strong className="text-gray-700">{users.length}</strong>
            </>
          )}
        </span>
      </div>

      {/* Table */}
      <UserTable users={users} currentUserId={session.userId} />
    </div>
  );
}
