export const dynamic = "force-dynamic";

import { requireAuth } from "@/lib/auth/dal";
import { getUserSubscriptions } from "@/lib/services/subscriptionService";
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

export default async function AccountSubscriptionsPage() {
  const session = await requireAuth();
  const subscriptions = await getUserSubscriptions(session.userId);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">내 구독</h1>
          <p className="text-gray-500 mt-1">정기 구독 목록을 확인하세요</p>
        </div>
        <Link
          href="/subscribe"
          className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
        >
          구독 추가
        </Link>
      </div>

      {subscriptions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center space-y-3">
          <p className="text-gray-500">아직 구독이 없습니다</p>
          <Link href="/subscribe" className="inline-block px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium">
            구독 신청하기
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((sub) => (
            <Link
              key={sub.id}
              href={`/account/subscriptions/${sub.id}`}
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-amber-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[sub.status] ?? "text-gray-600 bg-gray-100"}`}>
                      {STATUS_LABEL[sub.status] ?? sub.status}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      매주 {WEEKDAYS[sub.pickupWeekday]}요일
                    </span>
                    {sub.pickupTimeSlot && (
                      <span className="text-xs text-gray-500">{sub.pickupTimeSlot}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {sub.items.map((i) => `${i.product.name} ×${i.quantity}`).join(", ")}
                  </p>
                </div>
                <span className="text-gray-400 text-sm">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
