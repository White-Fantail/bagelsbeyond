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
        setMessage("Re-send successful");
      } else {
        setState("error");
        setMessage(data.result?.error ?? data.error ?? "Re-send failed");
      }
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Network error");
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
        title={`Re-send Order ${orderNumber}`}
      >
        {state === "loading" ? "Sending…" : state === "success" ? "✓ Success" : "Retry"}
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
