"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MirrorSyncResult } from "@/lib/integrations/services/loyverse-mirror-sync";

export default function LoyverseSyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MirrorSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/integrations/loyverse/full-sync", {
        method: "POST",
      });
      const data = (await res.json()) as MirrorSyncResult & { message?: string };
      if (!res.ok || data.status === "failed") {
        setError(
          data.errors?.[0] ?? (data as { message?: string }).message ?? "Error during Sync"
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
    <div className="space-y-4">
      <button
        onClick={handleSync}
        disabled={loading}
        className="px-5 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Syncing…" : "🔄 Loyverse Full Sync"}
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
            {result.status === "success" ? "✓ Sync complete" : "⚠ Partial Sync Complete"}
            {result.finishedAt && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                {new Date(result.finishedAt).toLocaleString("en-NZ")}
              </span>
            )}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            <div className="bg-blue-50 rounded-lg p-2.5 text-center">
              <dt className="text-xs text-blue-600">Categories</dt>
              <dd className="text-lg font-bold text-blue-700 mt-0.5">{result.categoriesSynced}</dd>
            </div>
            <div className="bg-purple-50 rounded-lg p-2.5 text-center">
              <dt className="text-xs text-purple-600">Modifiers</dt>
              <dd className="text-lg font-bold text-purple-700 mt-0.5">{result.modifiersSynced}</dd>
            </div>
            <div className="bg-violet-50 rounded-lg p-2.5 text-center">
              <dt className="text-xs text-violet-600">Modifiers Options</dt>
              <dd className="text-lg font-bold text-violet-700 mt-0.5">{result.modifierOptionsSynced}</dd>
            </div>
            <div className="bg-green-50 rounded-lg p-2.5 text-center">
              <dt className="text-xs text-green-600">Products</dt>
              <dd className="text-lg font-bold text-green-700 mt-0.5">{result.itemsSynced}</dd>
            </div>
            <div className="bg-amber-50 rounded-lg p-2.5 text-center">
              <dt className="text-xs text-amber-600">Products-Modifiers Link</dt>
              <dd className="text-lg font-bold text-amber-700 mt-0.5">{result.itemModifierLinksSynced}</dd>
            </div>
            <div className="bg-sky-50 rounded-lg p-2.5 text-center">
              <dt className="text-xs text-sky-600">Variants</dt>
              <dd className="text-lg font-bold text-sky-700 mt-0.5">{result.variantsSynced}</dd>
            </div>
            <div className="bg-teal-50 rounded-lg p-2.5 text-center">
              <dt className="text-xs text-teal-600">Inventory Level</dt>
              <dd className="text-lg font-bold text-teal-700 mt-0.5">{result.inventoryLevelsSynced}</dd>
            </div>
            {result.errorCount > 0 && (
              <div className="bg-red-50 rounded-lg p-2.5 text-center">
                <dt className="text-xs text-red-600">Error</dt>
                <dd className="text-lg font-bold text-red-700 mt-0.5">{result.errorCount}</dd>
              </div>
            )}
          </div>

          {/* Modifier link diagnostics — split into HTTP raw / JSON.parse / parsed / final stages */}
          <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3 space-y-2.5">
            <p className="text-xs font-semibold text-amber-800">Products-Modifiers Link Diagnosis</p>

            {/* Stage A: HTTP Raw Response */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-700">[A] HTTP Raw Response</p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-amber-700">
                <li>
                  <span className="font-medium">Mock mode:</span>{" "}
                  {result.loyverseMock ? "Yes (no actual HTTP)" : "No"}
                </li>
                <li>
                  <span className="font-medium">HTTP status:</span>{" "}
                  {result.itemsFetchHttpStatus ?? "N/A"}
                </li>
                <li className="col-span-2">
                  <span className="font-medium">Request URL:</span>{" "}
                  {result.itemsFetchUrl ?? "N/A"}
                </li>
                <li>
                  <span className="font-medium">original contains &quot;modifier_ids&quot;:</span>{" "}
                  {result.rawBodyContainsModifiersIds === null
                    ? "N/A (mock)"
                    : result.rawBodyContainsModifiersIds
                    ? "✓ Yes"
                    : "✗ None"}
                </li>
                <li>
                  <span className="font-medium">Fallback used:</span> No
                </li>
                <li>
                  <span className="font-medium">Cache used:</span> No
                </li>
              </ul>
            </div>

            {/* Stage B: After JSON.parse */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-700">[B] After JSON.parse (before deleted_at filter)</p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-amber-700">
                <li>
                  <span className="font-medium">modifier_ids Yes:</span>{" "}
                  {result.rawItemsWithModifiersIds ?? 0}
                </li>
                <li>
                  <span className="font-medium">modifier_ids None:</span>{" "}
                  {result.rawItemsWithoutModifiersIds ?? 0}
                </li>
              </ul>
            </div>

            {/* Stage C: Parsed DTO (Active Products only) */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-700">[C] Parsed DTO (Active Products only)</p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-amber-700">
                <li>
                  <span className="font-medium">modifier_ids field absent:</span>{" "}
                  {result.itemsWithoutModifierField ?? 0}
                </li>
                <li>
                  <span className="font-medium">modifier_ids empty array:</span>{" "}
                  {result.itemsWithEmptyModifiers ?? 0}
                </li>
              </ul>
            </div>

            {/* Stage D: Link Create Result */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-700">[D] Link Create Result</p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-amber-700">
                <li>
                  <span className="font-medium">modifier match failed:</span>{" "}
                  {result.modifierNotFoundLocally ?? 0}
                </li>
                <li>
                  <span className="font-medium">link creation success:</span>{" "}
                  {result.itemModifierLinksSynced ?? 0}
                </li>
                <li>
                  <span className="font-medium">link create failed:</span>{" "}
                  {result.linkInsertErrors ?? 0}
                </li>
                <li>
                  <span className="font-medium">DB persisted (actual rows):</span>{" "}
                  {result.itemModifierLinksPersisted ?? 0}
                </li>
              </ul>
            </div>
          </div>

          {result.errors && result.errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
              <p className="text-xs font-medium text-red-700">Error Details (max 5)</p>
              <ul className="space-y-1">
                {result.errors.slice(0, 5).map((e: string, i: number) => (
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
