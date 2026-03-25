"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CollectionResult } from "@/lib/services/externalFactorService";

type Props = {
  recordId: string;
};

export default function RefreshExternalFactorButton({ recordId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CollectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCollect = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/sales/${recordId}/collect-external`, {
        method: "POST",
      });
      const data = await res.json() as CollectionResult & { message?: string };
      if (!res.ok) throw new Error(data.message ?? "수집에 실패했습니다");
      setResult(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleCollect}
        disabled={loading}
        className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-50 transition-colors font-medium"
      >
        {loading ? "수집 중..." : "🔄 외부 데이터 수집"}
      </button>
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
      {result && (
        <div className="text-xs">
          {result.success ? (
            <span className="text-green-600">
              ✅ 수집 완료
              {result.collectedFields.length > 0 && ` (${result.collectedFields.join(", ")})`}
              {result.failedProviders.length > 0 && (
                <span className="text-yellow-600 ml-1">
                  ⚠️ 실패: {result.failedProviders.join(", ")}
                </span>
              )}
            </span>
          ) : (
            <span className="text-red-600">❌ 수집 실패</span>
          )}
        </div>
      )}
    </div>
  );
}
