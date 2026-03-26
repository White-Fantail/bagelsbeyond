"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelOrderAction } from "@/app/actions/order";

interface Props { orderNumber: string; }

export default function CancelOrderButton({ orderNumber }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelOrderAction(orderNumber);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.message ?? "취소 처리 중 오류가 발생했습니다");
        setShowConfirm(false);
      }
    });
  }

  if (!showConfirm) {
    return (
      <div className="space-y-2">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
        <button
          onClick={() => setShowConfirm(true)}
          className="w-full py-3 rounded-xl border border-red-300 text-red-600 font-medium hover:bg-red-50 transition-colors"
        >
          주문 취소
        </button>
      </div>
    );
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
      <p className="text-sm text-red-700 font-medium">정말 주문을 취소하시겠습니까?</p>
      <p className="text-xs text-red-500">취소 후에는 되돌릴 수 없습니다.</p>
      <div className="flex gap-3">
        <button
          onClick={() => setShowConfirm(false)}
          disabled={isPending}
          className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          돌아가기
        </button>
        <button
          onClick={handleCancel}
          disabled={isPending}
          className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
        >
          {isPending ? "취소 처리 중…" : "취소 확인"}
        </button>
      </div>
    </div>
  );
}
