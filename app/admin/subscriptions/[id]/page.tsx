export const dynamic = "force-dynamic";

import { requireStaffOrAdmin } from "@/lib/auth/dal";
import { getSubscriptionById } from "@/lib/services/subscriptionService";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminSubscriptionStatusForm from "./AdminSubscriptionStatusForm";

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

const OCC_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "예약됨",
  ORDER_CREATED: "주문생성",
  SKIPPED: "건너뜀",
  CANCELLED: "취소됨",
};

const OCC_STATUS_COLOR: Record<string, string> = {
  SCHEDULED: "text-blue-700 bg-blue-50",
  ORDER_CREATED: "text-green-700 bg-green-50",
  SKIPPED: "text-gray-500 bg-gray-100",
  CANCELLED: "text-red-600 bg-red-50",
};

export default async function AdminSubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireStaffOrAdmin();
  const { id } = await params;

  const sub = await getSubscriptionById(id);
  if (!sub) redirect("/admin/subscriptions");

  const fmt = new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/admin" className="hover:text-amber-600">관리자 대시보드</Link>
          <span>/</span>
          <Link href="/admin/subscriptions" className="hover:text-amber-600">구독 관리</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">구독 상세</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">구독 상세</h1>
      </div>

      {/* Subscription info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[sub.status] ?? "text-gray-600 bg-gray-100"}`}>
            {STATUS_LABEL[sub.status] ?? sub.status}
          </span>
          <span className="font-semibold text-gray-900">매주 {WEEKDAYS[sub.pickupWeekday]}요일</span>
          {sub.pickupTimeSlot && <span className="text-sm text-gray-500">{sub.pickupTimeSlot}</span>}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-500 text-xs">고객</p>
            <p className="font-medium">{sub.user.name}</p>
            <p className="text-xs text-gray-400">{sub.user.email}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">시작일</p>
            <p className="font-medium">{fmt.format(new Date(sub.startDate))}</p>
          </div>
          {sub.endDate && (
            <div>
              <p className="text-gray-500 text-xs">종료일</p>
              <p className="font-medium">{fmt.format(new Date(sub.endDate))}</p>
            </div>
          )}
        </div>

        {sub.note && (
          <div>
            <p className="text-gray-500 text-xs">메모</p>
            <p className="text-sm text-gray-700">{sub.note}</p>
          </div>
        )}

        <div>
          <p className="text-gray-500 text-xs mb-1">구독 상품</p>
          <div className="space-y-1">
            {sub.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.product.name}</span>
                <span className="text-gray-500">×{item.quantity}</span>
              </div>
            ))}
          </div>
        </div>

        {session.role === "ADMIN" && sub.status !== "CANCELLED" && (
          <AdminSubscriptionStatusForm subscriptionId={sub.id} currentStatus={sub.status} />
        )}
      </div>

      {/* Occurrences */}
      {sub.occurrences.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">발생 내역</h2>
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
                {occ.order && (
                  <Link href={`/admin/orders/${occ.order.orderNumber}`} className="text-xs text-amber-600 hover:underline">
                    {occ.order.orderNumber}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
