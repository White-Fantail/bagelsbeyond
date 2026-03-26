"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ModifierSyncResult {
  status: "success" | "empty" | "failed";
  groupCount: number;
  optionCount: number;
  updatedGroups?: number;
  updatedOptions?: number;
  syncedAt: string;
  errorMessage?: string;
  errorCode?: number;
  message?: string;
}

export default function ModifierSyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ModifierSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/integrations/loyverse/modifier-sync", {
        method: "POST",
      });
      const data = (await res.json()) as ModifierSyncResult;
      if (!res.ok || data.status === "failed") {
        setError(data.errorMessage ?? data.message ?? "Modifier 동기화 중 오류가 발생했습니다");
      } else {
        setResult(data);
        // Refresh the page to reflect updated group/option data.
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleSync}
        disabled={loading}
        className="px-5 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "동기화 중…" : "🔄 Loyverse Modifier 동기화"}
      </button>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <strong>동기화 실패:</strong> {error}
        </div>
      )}

      {result && !error && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 space-y-1">
          <p className="font-semibold">
            ✓ Modifier 동기화 완료
            <span className="ml-2 text-xs font-normal text-green-600">
              {new Date(result.syncedAt).toLocaleString("ko-KR")}
            </span>
          </p>
          <p className="text-xs text-green-700">
            Loyverse: 그룹 {result.groupCount}개 · 옵션 {result.optionCount}개
          </p>
          {(result.updatedGroups !== undefined || result.updatedOptions !== undefined) && (
            <p className="text-xs text-green-600">
              내부 DB 갱신: 그룹 {result.updatedGroups ?? 0}개 · 옵션 {result.updatedOptions ?? 0}개
            </p>
          )}
        </div>
      )}
    </div>
  );
}
