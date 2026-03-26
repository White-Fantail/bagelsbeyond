export const dynamic = "force-dynamic";

import { requireAuth } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "임시", PENDING: "접수됨", CONFIRMED: "확인됨",
  PREPARING: "준비중", READY: "준비완료", COMPLETED: "완료", CANCELLED: "취소됨",
};

export default async function OrderSuccessPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const session = await requireAuth();
  const { orderNumber } = await params;

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: {
        include: { options: true },
      },
    },
  });

  if (!order || order.userId !== session.userId) notFound();

  const pickupDateStr = order.pickupDate
    ? new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(order.pickupDate))
    : "-";

  return (
    <div className="max-w-xl mx-auto py-8 space-y-6 text-center">
      <div>
        <p className="text-5xl mb-3">🎉</p>
        <h1 className="text-2xl font-bold text-gray-900">주문이 완료되었습니다!</h1>
        <p className="text-gray-500 mt-2 text-sm">주문을 접수했습니다. 픽업 날짜에 방문해주세요.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 text-left space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">주문번호</span>
          <span className="font-mono font-semibold text-gray-900">{order.orderNumber}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">상태</span>
          <span className="font-medium text-amber-700">{STATUS_LABELS[order.status] ?? order.status}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">픽업 날짜</span>
          <span className="font-medium text-gray-900">{pickupDateStr}</span>
        </div>
        {order.pickupTimeSlot && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">픽업 시간</span>
            <span className="font-medium text-gray-900">{order.pickupTimeSlot}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">총 금액</span>
          <span className="font-bold text-gray-900">${order.totalAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">결제</span>
          <span className="text-gray-700">현장 결제</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 text-left space-y-2">
        <h2 className="font-semibold text-sm text-gray-800 mb-2">주문 상품</h2>
        {order.items.map((item) => (
          <div key={item.id} className="text-sm">
            <div className="flex justify-between">
              <span className="text-gray-800">{item.productNameSnapshot} × {item.quantity}</span>
              <span className="font-medium">${item.lineTotal.toFixed(2)}</span>
            </div>
            {item.options.length > 0 && (
              <p className="text-xs text-gray-400 ml-2">
                {item.options.map((o) => o.optionNameSnapshot).join(", ")}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <Link href="/account/orders" className="block py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600">
          내 주문 보기
        </Link>
        <Link href="/order" className="block py-3 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50">
          계속 쇼핑하기
        </Link>
      </div>
    </div>
  );
}
