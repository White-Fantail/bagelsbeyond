export const dynamic = "force-dynamic";

import { requireStaffOrAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import Link from "next/link";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "활성",
  PAUSED: "일시정지",
  CANCELLED: "취소됨",
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
            <Link href="/admin" className="hover:text-amber-600">관리자 대시보드</Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">구독 관리</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">구독 관리</h1>
          <p className="text-gray-500 text-sm mt-0.5">전체 구독 조회 (STAFF 이상)</p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 bg-white rounded-xl border border-gray-200 p-4">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="">전체 상태</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button type="submit" className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600">
          검색
        </button>
        <Link href="/admin/subscriptions" className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
          초기화
        </Link>
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {subscriptions.length === 0 ? (
          <div className="p-10 text-center text-gray-500">조건에 맞는 구독이 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">고객</th>
                  <th className="px-4 py-3 text-left">상태</th>
                  <th className="px-4 py-3 text-left">요일</th>
                  <th className="px-4 py-3 text-left">상품</th>
                  <th className="px-4 py-3 text-left">시작일</th>
                  <th className="px-4 py-3 text-left">상세</th>
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
                      매주 {WEEKDAYS[sub.pickupWeekday]}요일
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {sub.items.map((i) => `${i.product.name}×${i.quantity}`).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(sub.startDate).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/subscriptions/${sub.id}`} className="text-amber-600 hover:underline text-xs">
                        상세 →
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
