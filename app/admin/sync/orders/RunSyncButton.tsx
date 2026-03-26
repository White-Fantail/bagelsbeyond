"use client";

import { useState } from "react";

export default function RunSyncButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<{
    pushSucceeded?: number;
    pushFailed?: number;
    skippedAlreadySent?: number;
    ensuredSubscriptionOrders?: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function handleRun() {
    setState("loading");
    setResult(null);
    setErrorMsg("");
    try {
      const res = await fetch("/api/cron/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "daily_order_push" }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        results?: { dailyOrderPush?: typeof result };
      };
      if (res.ok && data.ok) {
        setState("done");
        setResult(data.results?.dailyOrderPush ?? null);
      } else {
        setState("error");
        setErrorMsg(data.error ?? "알 수 없는 오류");
      }
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "네트워크 오류");
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleRun}
        disabled={state === "loading"}
        className={
          "px-4 py-2 rounded-lg text-sm font-medium transition-colors " +
          (state === "loading"
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-amber-500 text-white hover:bg-amber-600")
        }
      >
        {state === "loading" ? "실행 중…" : "지금 자동 전송 실행"}
      </button>
      {state === "done" && result && (
        <p className="text-sm text-green-600">
          ✓ 완료 — 성공 {result.pushSucceeded ?? 0}건 / 실패 {result.pushFailed ?? 0}건 / 이미 전송됨{" "}
          {result.skippedAlreadySent ?? 0}건
        </p>
      )}
      {state === "error" && (
        <p className="text-sm text-red-500">오류: {errorMsg}</p>
      )}
    </div>
  );
}
