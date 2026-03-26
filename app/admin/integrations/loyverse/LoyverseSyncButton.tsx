"use client";

import { useState } from "react";
import type { CatalogSyncResult } from "@/lib/integrations/services/catalog-sync";

interface SyncButtonProps {
  lastResult?: CatalogSyncResult | null;
}

export default function LoyverseSyncButton({ lastResult: initialResult }: SyncButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CatalogSyncResult | null>(initialResult ?? null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/integrations/loyverse/sync", {
        method: "POST",
      });
      const data = (await res.json()) as CatalogSyncResult & { message?: string };
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
    <div className="space-y-4">
      <button
        onClick={handleSync}
        disabled={loading}
        className="px-5 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "동기화 중…" : "Loyverse 카탈로그 동기화 실행"}
      </button>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700 font-medium">동기화 실패</p>
          <p className="text-sm text-red-600 mt-0.5">{error}</p>
        </div>
      )}

      {result && !error && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800">
            마지막 동기화 결과
            {result.finishedAt && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                {new Date(result.finishedAt).toLocaleString("ko-KR")}
              </span>
            )}
          </p>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <dt className="text-xs text-gray-500">가져온 항목</dt>
              <dd className="text-xl font-bold text-gray-900 mt-0.5">{result.fetched}</dd>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <dt className="text-xs text-green-600">신규 생성</dt>
              <dd className="text-xl font-bold text-green-700 mt-0.5">{result.created}</dd>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <dt className="text-xs text-blue-600">업데이트</dt>
              <dd className="text-xl font-bold text-blue-700 mt-0.5">{result.updated}</dd>
            </div>
            <div
              className={`rounded-lg p-3 text-center ${result.errors.length > 0 ? "bg-red-50" : "bg-gray-50"}`}
            >
              <dt className={`text-xs ${result.errors.length > 0 ? "text-red-600" : "text-gray-500"}`}>
                오류
              </dt>
              <dd
                className={`text-xl font-bold mt-0.5 ${result.errors.length > 0 ? "text-red-700" : "text-gray-900"}`}
              >
                {result.errors.length}
              </dd>
            </div>
          </dl>

          {result.errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
              <p className="text-xs font-medium text-red-700">오류 상세</p>
              <ul className="space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-xs text-red-600">
                    • {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
