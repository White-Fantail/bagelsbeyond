"use client";

import { useState } from "react";

interface RetryButtonProps {
  orderId: string;
  orderNumber: string;
}

export default function RetryButton({ orderId, orderNumber }: RetryButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  async function handleRetry() {
    setState("loading");
    setMessage("");
    try {
      const res = await fetch("/api/admin/sync/orders/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; result?: { success: boolean; error?: string } };
      if (res.ok && data.result?.success) {
        setState("success");
        setMessage("재전송 성공");
      } else {
        setState("error");
        setMessage(data.result?.error ?? data.error ?? "재전송 실패");
      }
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "네트워크 오류");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleRetry}
        disabled={state === "loading" || state === "success"}
        className={
          "px-3 py-1 rounded text-xs font-medium transition-colors " +
          (state === "success"
            ? "bg-green-100 text-green-700 cursor-not-allowed"
            : state === "loading"
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-amber-100 text-amber-700 hover:bg-amber-200")
        }
        title={`주문 ${orderNumber} 재전송`}
      >
        {state === "loading" ? "전송 중…" : state === "success" ? "✓ 성공" : "재시도"}
      </button>
      {message && (
        <span
          className={
            "text-xs " +
            (state === "success" ? "text-green-600" : "text-red-500")
          }
        >
          {message}
        </span>
      )}
    </div>
  );
}
