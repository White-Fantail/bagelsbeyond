"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatusAction } from "@/app/actions/order";
import type { OrderStatus } from "@/app/generated/prisma/enums";

const ALL_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "PENDING", label: "접수됨" },
  { value: "CONFIRMED", label: "확인됨" },
  { value: "PREPARING", label: "준비중" },
  { value: "READY", label: "준비완료" },
  { value: "COMPLETED", label: "완료" },
  { value: "CANCELLED", label: "취소됨" },
];

interface Props {
  orderNumber: string;
  currentStatus: string;
}

export default function OrderStatusChanger({ orderNumber, currentStatus }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string>(currentStatus);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleUpdate() {
    if (selected === currentStatus) return;
    setMessage(null);
    startTransition(async () => {
      const result = await updateOrderStatusAction(orderNumber, selected as OrderStatus);
      if (result.success) {
        setMessage({ type: "success", text: "상태가 변경되었습니다" });
        router.refresh();
      } else {
        setMessage({ type: "error", text: result.message ?? "오류가 발생했습니다" });
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">상태 변경</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={isPending || currentStatus === "COMPLETED" || currentStatus === "CANCELLED"}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-gray-50"
        >
          {ALL_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <button
          onClick={handleUpdate}
          disabled={isPending || selected === currentStatus || currentStatus === "COMPLETED" || currentStatus === "CANCELLED"}
          className="px-4 py-1.5 text-sm rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
        >
          {isPending ? "처리 중…" : "변경"}
        </button>
      </div>
      {message && (
        <p className={`text-xs ${message.type === "success" ? "text-green-700" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
