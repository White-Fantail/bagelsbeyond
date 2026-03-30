"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogSyncOrchestrationResult } from "@/lib/integrations/loyverse/orchestrate";

export default function LoyverseSyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CatalogSyncOrchestrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/integrations/loyverse/catalog-sync", {
        method: "POST",
      });
      const data = (await res.json()) as CatalogSyncOrchestrationResult & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Error during sync");
      } else if (data.errors && data.errors.length > 0) {
        setError(data.errors[0]);
        setResult(data);
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

  const mirror = result?.mirror_sync_summary;
  const canonical = result?.canonical_mapping_summary;
  const hasWarnings = (result?.warnings?.length ?? 0) > 0;
  const hasErrors = (result?.errors?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <button
        onClick={handleSync}
        disabled={loading}
        className="px-5 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Syncing…" : "🔄 Loyverse Catalog Sync"}
      </button>

      {error && !result && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700 font-medium">Sync Failed</p>
          <p className="text-sm text-red-600 mt-0.5">{error}</p>
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
          <p className="text-sm font-semibold text-gray-800">
            {hasErrors ? "⚠ Sync completed with errors" : hasWarnings ? "⚠ Sync complete (with warnings)" : "✓ Sync complete"}
          </p>

          {mirror && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mirror Sync</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                  <dt className="text-xs text-blue-600">Categories</dt>
                  <dd className="text-lg font-bold text-blue-700 mt-0.5">{mirror.categories_upserted}</dd>
                </div>
                <div className="bg-green-50 rounded-lg p-2.5 text-center">
                  <dt className="text-xs text-green-600">Items</dt>
                  <dd className="text-lg font-bold text-green-700 mt-0.5">{mirror.items_upserted}</dd>
                </div>
                <div className="bg-sky-50 rounded-lg p-2.5 text-center">
                  <dt className="text-xs text-sky-600">Variants</dt>
                  <dd className="text-lg font-bold text-sky-700 mt-0.5">{mirror.variants_upserted}</dd>
                </div>
                <div className="bg-purple-50 rounded-lg p-2.5 text-center">
                  <dt className="text-xs text-purple-600">Modifier Groups</dt>
                  <dd className="text-lg font-bold text-purple-700 mt-0.5">{mirror.modifier_groups_upserted}</dd>
                </div>
                <div className="bg-violet-50 rounded-lg p-2.5 text-center">
                  <dt className="text-xs text-violet-600">Modifier Options</dt>
                  <dd className="text-lg font-bold text-violet-700 mt-0.5">{mirror.modifier_options_upserted}</dd>
                </div>
                <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                  <dt className="text-xs text-amber-600">Payment Types</dt>
                  <dd className="text-lg font-bold text-amber-700 mt-0.5">{mirror.payment_types_upserted}</dd>
                </div>
              </div>
            </div>
          )}

          {canonical && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Canonical Mapping</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                <div className="bg-teal-50 rounded-lg p-2.5 text-center">
                  <dt className="text-xs text-teal-600">Categories</dt>
                  <dd className="text-lg font-bold text-teal-700 mt-0.5">{canonical.categories_mapped}</dd>
                </div>
                <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
                  <dt className="text-xs text-emerald-600">Items</dt>
                  <dd className="text-lg font-bold text-emerald-700 mt-0.5">{canonical.items_mapped}</dd>
                </div>
                <div className="bg-cyan-50 rounded-lg p-2.5 text-center">
                  <dt className="text-xs text-cyan-600">Variants</dt>
                  <dd className="text-lg font-bold text-cyan-700 mt-0.5">{canonical.variants_mapped}</dd>
                </div>
                <div className="bg-indigo-50 rounded-lg p-2.5 text-center">
                  <dt className="text-xs text-indigo-600">Modifier Groups</dt>
                  <dd className="text-lg font-bold text-indigo-700 mt-0.5">{canonical.modifier_groups_mapped}</dd>
                </div>
                <div className="bg-fuchsia-50 rounded-lg p-2.5 text-center">
                  <dt className="text-xs text-fuchsia-600">Modifier Options</dt>
                  <dd className="text-lg font-bold text-fuchsia-700 mt-0.5">{canonical.modifier_options_mapped}</dd>
                </div>
                <div className="bg-lime-50 rounded-lg p-2.5 text-center">
                  <dt className="text-xs text-lime-600">Item-Modifier Links</dt>
                  <dd className="text-lg font-bold text-lime-700 mt-0.5">{canonical.item_modifier_group_links_created}</dd>
                </div>
              </div>
            </div>
          )}

          {hasErrors && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
              <p className="text-xs font-medium text-red-700">Errors</p>
              <ul className="space-y-1">
                {result.errors.slice(0, 5).map((e, i) => (
                  <li key={i} className="text-xs text-red-600">• {e}</li>
                ))}
              </ul>
            </div>
          )}

          {hasWarnings && !hasErrors && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 space-y-1">
              <p className="text-xs font-medium text-yellow-700">Warnings ({result.warnings.length})</p>
              <ul className="space-y-1">
                {result.warnings.slice(0, 3).map((w, i) => (
                  <li key={i} className="text-xs text-yellow-700">• {w}</li>
                ))}
                {result.warnings.length > 3 && (
                  <li className="text-xs text-yellow-600">…and {result.warnings.length - 3} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
