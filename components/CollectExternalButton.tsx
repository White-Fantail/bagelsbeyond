"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CollectionResult } from "@/lib/services/externalFactorService";

type Props = {
  date: string; // YYYY-MM-DD
};

export default function CollectExternalButton({ date }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CollectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCollect = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/external-factors/${date}`, { method: "POST" });
      const data = await res.json() as { result?: CollectionResult; message?: string };
      if (!res.ok) throw new Error(data.message ?? "Collection failed");
      if (data.result) setResult(data.result);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleCollect}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
      >
        {loading ? "Collecting..." : "🔄 Collect External Data"}
      </button>
      {error && (
        <p className="text-xs text-red-500 max-w-xs text-right">{error}</p>
      )}
      {result && (
        <div className="text-xs text-right max-w-xs">
          {result.success ? (
            <div className="space-y-0.5">
              <p className="text-green-600 font-medium">✅ Collection complete</p>
              {result.collectedFields.length > 0 && (
                <p className="text-gray-500">Collected: {result.collectedFields.join(", ")}</p>
              )}
              {result.failedProviders.length > 0 && (
                <p className="text-yellow-600">⚠️ Failed: {result.failedProviders.join(", ")}</p>
              )}
              {result.skippedProviders.length > 0 && (
                <p className="text-gray-400">Skipped: {result.skippedProviders.join(", ")}</p>
              )}
            </div>
          ) : (
            <p className="text-red-600">❌ Collection failed</p>
          )}
        </div>
      )}
    </div>
  );
}
