export const dynamic = "force-dynamic";

import { requireStaffOrAdmin } from "@/lib/auth/dal";
import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  OrderSource,
  OrderStatus,
  IntegrationSource,
  Role,
} from "@/app/generated/prisma/enums";
import { getBusinessDate, toBusinessDateString, getBusinessTimezone } from "@/lib/utils/business-date";
import { isLoyverseMockMode } from "@/lib/integrations/adapters/pos/loyverse";
import RetryButton from "./RetryButton";
import RunSyncButton from "./RunSyncButton";

export default async function SyncOrdersPage() {
  const session = await requireStaffOrAdmin();
  const isAdmin = session.role === Role.ADMIN;

  const today = getBusinessDate();
  const todayStr = toBusinessDateString(today);
  const timezone = getBusinessTimezone();
  const mockMode = isLoyverseMockMode();

  // ── Counts for today ───────────────────────────────────────────────────────
  const [internalCount, subscriptionCount] = await Promise.all([
    prisma.order.count({
      where: {
        pickupDate: today,
        status: { not: OrderStatus.CANCELLED },
        source: OrderSource.INTERNAL,
      },
    }),
    prisma.order.count({
      where: {
        pickupDate: today,
        status: { not: OrderStatus.CANCELLED },
        source: OrderSource.SUBSCRIPTION,
      },
    }),
  ]);

  // ── Sync status breakdown for today ───────────────────────────────────────
  const todayOrders = await prisma.order.findMany({
    where: {
      pickupDate: today,
      status: { not: OrderStatus.CANCELLED },
      source: { in: [OrderSource.INTERNAL, OrderSource.SUBSCRIPTION] },
    },
    include: { externalMapping: true },
    orderBy: { createdAt: "desc" },
  });

  const successOrders = todayOrders.filter(
    (o) =>
      o.externalMapping?.syncStatus === "success" ||
      o.externalMapping?.syncStatus === "synced"
  );
  const failedOrders = todayOrders.filter(
    (o) => o.externalMapping?.syncStatus === "failed"
  );
  const pendingOrders = todayOrders.filter(
    (o) => o.externalMapping?.syncStatus === "pending"
  );
  const notSentOrders = todayOrders.filter((o) => !o.externalMapping);

  // ── Last sync time ─────────────────────────────────────────────────────────
  const lastSyncEntry = await prisma.externalOrderMap.findFirst({
    where: { source: IntegrationSource.LOYVERSE },
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb + header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/admin" className="hover:text-amber-600 transition-colors">
            관리자 대시보드
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">주문 자동 전송 현황</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">주문 자동 전송 현황</h1>
            <p className="text-gray-500 mt-0.5 text-sm">
              오늘({todayStr}) 픽업 예정 주문의 Loyverse 자동 전송 상태
              {mockMode && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  Mock 모드
                </span>
              )}
            </p>
          </div>
          {/* Manual trigger — ADMIN only via cron/run */}
          {isAdmin && (
            <div className="flex-shrink-0">
              <RunSyncButton />
            </div>
          )}
        </div>
      </div>

      {/* Config info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 flex flex-wrap gap-x-6 gap-y-1">
        <span>📅 기준 타임존: <strong>{timezone}</strong></span>
        <span>📆 오늘 날짜: <strong>{todayStr}</strong></span>
        <span>🕐 마지막 전송: <strong>
          {lastSyncEntry?.updatedAt
            ? lastSyncEntry.updatedAt.toLocaleString("ko-KR")
            : "없음"}
        </strong></span>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="웹 주문 (INTERNAL)" value={internalCount} color="blue" />
        <StatCard label="구독 주문 (SUBSCRIPTION)" value={subscriptionCount} color="purple" />
        <StatCard label="전송 성공" value={successOrders.length} color="green" />
        <StatCard label="전송 실패" value={failedOrders.length} color="red" />
        <StatCard label="처리 중" value={pendingOrders.length} color="amber" />
        <StatCard label="미전송" value={notSentOrders.length} color="gray" />
      </div>

      {/* Failed orders */}
      {failedOrders.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 p-6 space-y-4">
          <h2 className="font-semibold text-red-700">
            ❌ 전송 실패 주문 ({failedOrders.length}건)
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 pr-4">주문번호</th>
                  <th className="pb-2 pr-4">소스</th>
                  <th className="pb-2 pr-4">실패 이유</th>
                  {isAdmin && <th className="pb-2">재시도</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {failedOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-700">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="hover:text-amber-600"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium " +
                          (order.source === "SUBSCRIPTION"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700")
                        }
                      >
                        {order.source}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-red-600 text-xs max-w-xs truncate">
                      {order.externalMapping?.errorMessage ?? "-"}
                    </td>
                    {isAdmin && (
                      <td className="py-2">
                        <RetryButton
                          orderId={order.id}
                          orderNumber={order.orderNumber}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Not-yet-sent orders */}
      {notSentOrders.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-700">
            ⏳ 미전송 주문 ({notSentOrders.length}건)
          </h2>
          <p className="text-sm text-gray-500">
            자동 전송 대상이지만 아직 전송 시도가 없는 주문입니다.
            {isAdmin && " 아래에서 수동 전송하거나 상단 버튼으로 전체 재실행하세요."}
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 pr-4">주문번호</th>
                  <th className="pb-2 pr-4">소스</th>
                  <th className="pb-2 pr-4">픽업 시간대</th>
                  {isAdmin && <th className="pb-2">전송</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {notSentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-700">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="hover:text-amber-600"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium " +
                          (order.source === "SUBSCRIPTION"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700")
                        }
                      >
                        {order.source}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-600 text-xs">
                      {order.pickupTimeSlot ?? "-"}
                    </td>
                    {isAdmin && (
                      <td className="py-2">
                        <RetryButton
                          orderId={order.id}
                          orderNumber={order.orderNumber}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Success list */}
      {successOrders.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-700">
            ✅ 전송 성공 주문 ({successOrders.length}건)
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 pr-4">주문번호</th>
                  <th className="pb-2 pr-4">소스</th>
                  <th className="pb-2 pr-4">외부 수신번호</th>
                  <th className="pb-2">전송 시각</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {successOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-700">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="hover:text-amber-600"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium " +
                          (order.source === "SUBSCRIPTION"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700")
                        }
                      >
                        {order.source}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-600">
                      {order.externalMapping?.externalOrderId ?? "-"}
                    </td>
                    <td className="py-2 text-xs text-gray-500">
                      {order.externalMapping?.lastSyncedAt
                        ? order.externalMapping.lastSyncedAt.toLocaleString("ko-KR")
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Policy info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-2">
        <h2 className="font-semibold text-gray-900">자동 전송 정책</h2>
        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li>오늘 픽업 예정인 INTERNAL + SUBSCRIPTION 주문만 자동 전송</li>
          <li>미래 날짜 주문은 미리 POS에 전송하지 않음</li>
          <li>성공 전송된 주문은 기본적으로 재전송하지 않음 (중복 방지)</li>
          <li>취소(CANCELLED) 주문은 전송 대상에서 제외</li>
          <li>상품 Loyverse 매핑 누락 시 전송 실패로 기록</li>
          <li>내부 주문은 전송 실패와 무관하게 정상 유지됨</li>
          <li>
            기준 타임존: <strong>{timezone}</strong>{" "}
            (APP_TIMEZONE 환경변수로 변경)
          </li>
        </ul>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "blue" | "purple" | "green" | "red" | "amber" | "gray";
}) {
  const colorMap = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    green: "bg-green-50 border-green-200 text-green-700",
    red: "bg-red-50 border-red-200 text-red-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    gray: "bg-gray-50 border-gray-200 text-gray-700",
  };

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-0.5 opacity-80">{label}</div>
    </div>
  );
}
