"use client";

import { useState } from "react";

interface SyncResult {
  fetched: number;
  created: number;
  updated: number;
  errors: string[];
  finishedAt?: string;
  message?: string;
}

export default function CatalogSyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/integrations/loyverse/sync", {
        method: "POST",
      });
      const data = (await res.json()) as SyncResult;
      if (!res.ok) {
        setError(data.message ?? "동기화 중 오류가 발생했습니다");
      } else {
        setResult(data);
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
        {loading ? "동기화 중…" : "🔄 Loyverse 카탈로그 동기화"}
      </button>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <strong>동기화 실패:</strong> {error}
        </div>
      )}

      {result && !error && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 space-y-1">
          <p className="font-semibold">
            ✓ 동기화 완료
            {result.finishedAt && (
              <span className="ml-2 text-xs font-normal text-green-600">
                {new Date(result.finishedAt).toLocaleString("ko-KR")}
              </span>
            )}
          </p>
          <p className="text-xs text-green-700">
            가져옴 {result.fetched}개 · 신규 {result.created}개 · 업데이트 {result.updated}개
            {result.errors.length > 0 && (
              <span className="text-red-600"> · 오류 {result.errors.length}개</span>
            )}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {result.errors.map((e, i) => (
                <li key={i} className="text-xs text-red-600">• {e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
