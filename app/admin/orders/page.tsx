export const dynamic = "force-dynamic";

import { requireStaffOrAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "임시", PENDING: "접수됨", CONFIRMED: "확인됨",
  PREPARING: "준비중", READY: "준비완료", COMPLETED: "완료", CANCELLED: "취소됨",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "text-amber-700 bg-amber-50",
  CONFIRMED: "text-blue-700 bg-blue-50",
  PREPARING: "text-purple-700 bg-purple-50",
  READY: "text-green-700 bg-green-50",
  COMPLETED: "text-gray-600 bg-gray-100",
  CANCELLED: "text-red-600 bg-red-50",
  DRAFT: "text-gray-500 bg-gray-50",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; date?: string; q?: string }>;
}) {
  await requireStaffOrAdmin();
  const { status, date, q } = await searchParams;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (date) {
    const d = new Date(date + "T00:00:00.000Z");
    where.pickupDate = d;
  }
  if (q) {
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { customerNameSnapshot: { contains: q, mode: "insensitive" } },
      { customerEmailSnapshot: { contains: q, mode: "insensitive" } },
    ];
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      orderNumber: true,
      status: true,
      source: true,
      pickupDate: true,
      pickupTimeSlot: true,
      totalAmount: true,
      customerNameSnapshot: true,
      customerEmailSnapshot: true,
      createdAt: true,
    },
  });

  const fmt = new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/admin" className="hover:text-amber-600">관리자 대시보드</Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">주문 관리</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">주문 관리</h1>
          <p className="text-gray-500 text-sm mt-0.5">전체 주문 조회 및 상태 관리 (STAFF 이상)</p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 bg-white rounded-xl border border-gray-200 p-4">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="주문번호 / 고객명 / 이메일"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-40 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="">전체 상태</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <input
          type="date"
          name="date"
          defaultValue={date ?? ""}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button type="submit" className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600">
          검색
        </button>
        <Link href="/admin/orders" className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
          초기화
        </Link>
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {orders.length === 0 ? (
          <div className="p-10 text-center text-gray-500">조건에 맞는 주문이 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">주문번호</th>
                  <th className="px-4 py-3 text-left">고객</th>
                  <th className="px-4 py-3 text-left">상태</th>
                  <th className="px-4 py-3 text-left">픽업일</th>
                  <th className="px-4 py-3 text-right">금액</th>
                  <th className="px-4 py-3 text-left">출처</th>
                  <th className="px-4 py-3 text-left">주문일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((o) => (
                  <tr key={o.orderNumber} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${o.orderNumber}`} className="font-mono text-amber-600 hover:underline font-medium">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{o.customerNameSnapshot ?? "-"}</p>
                      <p className="text-xs text-gray-400">{o.customerEmailSnapshot ?? ""}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[o.status] ?? "text-gray-600 bg-gray-100"}`}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {o.pickupDate ? fmt.format(new Date(o.pickupDate)) : "-"}
                      {o.pickupTimeSlot && <span className="text-gray-400 ml-1">{o.pickupTimeSlot}</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">${o.totalAmount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{o.source}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmt.format(new Date(o.createdAt))}</td>
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
