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
      const res = await fetch("/api/admin/sync/orders/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        result?: typeof result;
      };
      if (res.ok && data.ok) {
        setState("done");
        setResult(data.result ?? null);
      } else {
        setState("error");
        setErrorMsg(data.error ?? "Unknown error");
      }
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Network error");
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
        {state === "loading" ? "Running..." : "Run Auto-Send Now"}
      </button>
      {state === "done" && result && (
        <p className="text-sm text-green-600">
          ✓ Done — Success {result.pushSucceeded ?? 0} / Failed {result.pushFailed ?? 0} / Already sent{" "}
          {result.skippedAlreadySent ?? 0}items
        </p>
      )}
      {state === "done" && !result && (
        <p className="text-sm text-green-600">✓ Run complete</p>
      )}
      {state === "error" && (
        <p className="text-sm text-red-500">Error: {errorMsg}</p>
      )}
    </div>
  );
}

