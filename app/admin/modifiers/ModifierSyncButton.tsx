"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FullSyncResult } from "@/lib/integrations/services/loyverse-full-sync";

export default function ModifierSyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FullSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/integrations/loyverse/full-sync", {
        method: "POST",
      });
      const data = (await res.json()) as FullSyncResult & { message?: string };
      if (!res.ok || data.status === "failed") {
        setError(
          data.errors?.[0] ?? (data as { message?: string }).message ?? "Error during Loyverse Full Sync"
        );
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
    <div className="space-y-3">
      <button
        onClick={handleSync}
        disabled={loading}
        className="px-5 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Syncing…" : "🔄 Loyverse Full Sync"}
      </button>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <strong>Sync Failed:</strong> {error}
        </div>
      )}

      {result && !error && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 space-y-1">
          <p className="font-semibold">
            {result.status === "success" ? "✓ All Sync Complete" : "⚠ Partial Sync Complete"}
            <span className="ml-2 text-xs font-normal text-green-600">
              {result.finishedAt && new Date(result.finishedAt).toLocaleString("en-NZ")}
            </span>
          </p>
          <p className="text-xs text-green-700">
            Modifier groups {result.modifierGroupsUpserted} · Options {result.modifierOptionsUpserted}
          </p>
          <p className="text-xs text-green-600">
            Products-Modifiers Link: {result.modifierLinksUpdated}items
          </p>
          {result.staleLinksRemoved > 0 && (
            <p className="text-xs text-amber-600">
              Stale links removed: {result.staleLinksRemoved}
            </p>
          )}
          {result.errorCount > 0 && (
            <p className="text-xs text-red-600">
              ⚠ Errors: {result.errorCount}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
