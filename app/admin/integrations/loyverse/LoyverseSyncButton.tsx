"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogSyncResult } from "@/lib/integrations/services/loyverse-catalog-sync";

export default function LoyverseSyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CatalogSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/integrations/loyverse/catalog-sync", {
        method: "POST",
      });
      const data = (await res.json()) as CatalogSyncResult & { message?: string };
      if (!res.ok || data.status === "failed") {
        setError(data.errors?.[0] ?? data.message ?? "Error during sync");
      } else {
        setResult(data);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
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
        {loading ? "Syncing…" : "🔄 Loyverse Catalog Sync"}
      </button>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700 font-medium">Sync Failed</p>
          <p className="text-sm text-red-600 mt-0.5">{error}</p>
        </div>
      )}

      {result && !error && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800">
            {result.status === "success" ? "✓ Sync complete" : "⚠ Partial sync complete"}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            <div className="bg-blue-50 rounded-lg p-2.5 text-center">
              <dt className="text-xs text-blue-600">Categories</dt>
              <dd className="text-lg font-bold text-blue-700 mt-0.5">{result.categoriesSynced}</dd>
            </div>
            <div className="bg-green-50 rounded-lg p-2.5 text-center">
              <dt className="text-xs text-green-600">Items</dt>
              <dd className="text-lg font-bold text-green-700 mt-0.5">{result.itemsSynced}</dd>
            </div>
            <div className="bg-sky-50 rounded-lg p-2.5 text-center">
              <dt className="text-xs text-sky-600">Variants</dt>
              <dd className="text-lg font-bold text-sky-700 mt-0.5">{result.variantsSynced}</dd>
            </div>
            <div className="bg-purple-50 rounded-lg p-2.5 text-center">
              <dt className="text-xs text-purple-600">Modifier Groups</dt>
              <dd className="text-lg font-bold text-purple-700 mt-0.5">{result.modifierGroupsSynced}</dd>
            </div>
            <div className="bg-violet-50 rounded-lg p-2.5 text-center">
              <dt className="text-xs text-violet-600">Modifier Options</dt>
              <dd className="text-lg font-bold text-violet-700 mt-0.5">{result.modifierOptionsSynced}</dd>
            </div>
            <div className="bg-amber-50 rounded-lg p-2.5 text-center">
              <dt className="text-xs text-amber-600">Payment Types</dt>
              <dd className="text-lg font-bold text-amber-700 mt-0.5">{result.paymentTypesSynced}</dd>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
              <p className="text-xs font-medium text-red-700">Errors</p>
              <ul className="space-y-1">
                {result.errors.slice(0, 5).map((e, i) => (
                  <li key={i} className="text-xs text-red-600">• {e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
