"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ScraperCredentialStatus } from "@/lib/services/scraperSyncService";
import type { SupplierRow } from "@/lib/services/supplierService";
import type { ScraperAdapterCredentialField } from "@/lib/suppliers/scrapers/base";

interface AdapterInfo {
  adapterKey: string;
  displayName: string;
}

interface SyncLogRow {
  id: string;
  status: string;
  triggeredByUserName: string | null;
  startedAt: string;
  finishedAt: string | null;
  totalLinks: number;
  successLinks: number;
  errorLinks: number;
  skippedLinks: number;
  errorSummary: string | null;
}

interface Props {
  supplier: SupplierRow;
  credentialStatus: ScraperCredentialStatus;
  adapters: AdapterInfo[];
  adapterFields: Record<string, ScraperAdapterCredentialField[]>;
  syncLogs: SyncLogRow[];
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function SyncStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    SUCCESS: "bg-green-100 text-green-700",
    PARTIAL: "bg-yellow-100 text-yellow-700",
    FAILED: "bg-red-100 text-red-700",
    RUNNING: "bg-blue-100 text-blue-700",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variants[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status}
    </span>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export default function SupplierScraperClient({
  supplier,
  credentialStatus,
  adapters,
  adapterFields,
  syncLogs: initialSyncLogs,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Credentials form state
  const [credStatus, setCredStatus] = useState<ScraperCredentialStatus>(credentialStatus);
  const [selectedAdapterKey, setSelectedAdapterKey] = useState(
    credentialStatus.adapterKey ?? adapters[0]?.adapterKey ?? ""
  );
  const [credFields, setCredFields] = useState<Record<string, string>>({});
  const [credNotes, setCredNotes] = useState(credentialStatus.notes ?? "");
  const [credMessage, setCredMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isSavingCreds, setIsSavingCreds] = useState(false);
  const [isDeletingCreds, setIsDeletingCreds] = useState(false);
  const [isTestingCreds, setIsTestingCreds] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{
      productCode: string | null;
      productName: string;
      purchasePrice: number;
      purchaseQuantity: number;
      purchaseUnit: string;
      isAvailable?: boolean;
    }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Sync state
  const [syncLogs, setSyncLogs] = useState<SyncLogRow[]>(initialSyncLogs);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Expanded log detail
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [logDetail, setLogDetail] = useState<{
    id: string;
    logEntries: Array<{ id: string; message: string; level: string; createdAt: string }>;
  } | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  function handleAdapterChange(key: string) {
    setSelectedAdapterKey(key);
    setCredFields({});
    setTestResult(null);
    setCredMessage(null);
  }

  const currentFields = adapterFields[selectedAdapterKey] ?? [];

  async function handleSaveCredentials() {
    if (!selectedAdapterKey) return;
    setIsSavingCreds(true);
    setCredMessage(null);
    setTestResult(null);
    try {
      const res = await fetch(
        `/api/admin/suppliers/${supplier.id}/scraper/credentials`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adapterKey: selectedAdapterKey,
            credentials: credFields,
            notes: credNotes || null,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setCredMessage({
          type: "error",
          text: data.message ?? "Failed to save credentials",
        });
      } else {
        setCredStatus(data.status);
        setCredMessage({ type: "success", text: "Credentials saved successfully" });
        startTransition(() => router.refresh());
      }
    } catch {
      setCredMessage({ type: "error", text: "Failed to connect to server" });
    } finally {
      setIsSavingCreds(false);
    }
  }

  async function handleDeleteCredentials() {
    if (
      !confirm(
        "Remove scraper credentials? This will disable scraper sync for this supplier."
      )
    )
      return;
    setIsDeletingCreds(true);
    setCredMessage(null);
    try {
      const res = await fetch(
        `/api/admin/suppliers/${supplier.id}/scraper/credentials`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        setCredMessage({
          type: "error",
          text: data.message ?? "Failed to delete credentials",
        });
      } else {
        setCredStatus({
          configured: false,
          adapterKey: null,
          adapterDisplayName: null,
          isActive: false,
          notes: null,
          updatedAt: null,
        });
        setCredFields({});
        setCredMessage({ type: "success", text: "Credentials removed" });
        startTransition(() => router.refresh());
      }
    } catch {
      setCredMessage({ type: "error", text: "Failed to connect to server" });
    } finally {
      setIsDeletingCreds(false);
    }
  }

  async function handleTestLogin() {
    setIsTestingCreds(true);
    setTestResult(null);
    try {
      const res = await fetch(
        `/api/admin/suppliers/${supplier.id}/scraper/credentials?action=test`,
        { method: "POST" }
      );
      const data = await res.json();
      setTestResult({
        ok: data.ok ?? false,
        message: data.message ?? "Unknown result",
      });
    } catch {
      setTestResult({ ok: false, message: "Failed to connect to server" });
    } finally {
      setIsTestingCreds(false);
    }
  }

  async function handleSearch() {
    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);
    try {
      const res = await fetch(
        `/api/admin/suppliers/${supplier.id}/scraper/search`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery, limit: 20 }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.message ?? "Search failed");
      } else {
        setSearchResults(data.products ?? []);
      }
    } catch {
      setSearchError("Failed to connect to server");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSync() {
    if (
      !confirm(
        "Run scraper sync now? This will log into the supplier website and update ingredient prices."
      )
    )
      return;
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch(
        `/api/admin/suppliers/${supplier.id}/scraper/sync`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        setSyncMessage({
          type: "error",
          text: data.message ?? "Scraper sync failed",
        });
      } else {
        const r = data.result;
        setSyncMessage({
          type: r.status === "FAILED" ? "error" : "success",
          text: `Sync complete — ${r.successLinks} updated, ${r.errorLinks} errors, ${r.skippedLinks} skipped`,
        });
        const logsRes = await fetch(
          `/api/admin/suppliers/${supplier.id}/scraper/sync?limit=20`
        );
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          setSyncLogs(logsData.syncLogs ?? []);
        }
        startTransition(() => router.refresh());
      }
    } catch {
      setSyncMessage({ type: "error", text: "Failed to connect to server" });
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleToggleLogDetail(logId: string) {
    if (expandedLogId === logId) {
      setExpandedLogId(null);
      setLogDetail(null);
      return;
    }
    setExpandedLogId(logId);
    setIsLoadingDetail(true);
    setLogDetail(null);
    try {
      const res = await fetch(
        `/api/admin/suppliers/${supplier.id}/scraper/sync-logs/${logId}`
      );
      const data = await res.json();
      if (res.ok) setLogDetail(data.log);
    } catch {
      // silently ignore
    } finally {
      setIsLoadingDetail(false);
    }
  }

  const isLoading = isPending || isSavingCreds || isDeletingCreds || isSyncing;

  return (
    <div className="space-y-8">
      {/* ── Credential Configuration ───────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Scraper Credentials
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Configure login credentials so the scraper can access this
              supplier&apos;s website and retrieve pricing.
            </p>
          </div>
          {credStatus.configured && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
              Configured
            </span>
          )}
        </div>

        {credMessage && (
          <div
            className={`px-4 py-3 rounded-lg text-sm font-medium ${
              credMessage.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {credMessage.text}
          </div>
        )}

        {credStatus.configured && (
          <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Adapter:</span>
              <span className="font-medium">{credStatus.adapterDisplayName}</span>
            </div>
            {credStatus.updatedAt && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Last updated:</span>
                <span>{new Date(credStatus.updatedAt).toLocaleString("en-NZ")}</span>
              </div>
            )}
            {credStatus.notes && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Notes:</span>
                <span>{credStatus.notes}</span>
              </div>
            )}
          </div>
        )}

        {/* Adapter select */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Scraper Adapter
          </label>
          <select
            value={selectedAdapterKey}
            onChange={(e) => handleAdapterChange(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">Select a scraper adapter…</option>
            {adapters.map((a) => (
              <option key={a.adapterKey} value={a.adapterKey}>
                {a.displayName}
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic credential fields */}
        {selectedAdapterKey && currentFields.length > 0 && (
          <div className="space-y-3">
            {currentFields.map((field) => (
              <div key={field.key} className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  {field.label}
                  {field.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                {field.hint && (
                  <p className="text-xs text-gray-500">{field.hint}</p>
                )}
                <input
                  type={field.type === "password" ? "password" : "text"}
                  value={credFields[field.key] ?? ""}
                  onChange={(e) =>
                    setCredFields((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  placeholder={
                    credStatus.configured && field.type === "password"
                      ? "(leave blank to keep existing)"
                      : (field.placeholder ?? "")
                  }
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            ))}

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Notes
              </label>
              <input
                type="text"
                value={credNotes}
                onChange={(e) => setCredNotes(e.target.value)}
                placeholder="Optional notes about this scraper configuration"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        )}

        {testResult && (
          <div
            className={`px-4 py-3 rounded-lg text-sm ${
              testResult.ok
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {testResult.ok ? "✓ " : "✗ "}
            {testResult.message}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSaveCredentials}
            disabled={isLoading || !selectedAdapterKey}
            className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSavingCreds ? "Saving…" : "Save Credentials"}
          </button>

          {credStatus.configured && (
            <>
              <button
                onClick={handleTestLogin}
                disabled={isLoading || isTestingCreds}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {isTestingCreds ? "Testing…" : "Test Login"}
              </button>
              <button
                onClick={handleDeleteCredentials}
                disabled={isLoading || isDeletingCreds}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-md text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {isDeletingCreds ? "Removing…" : "Remove Credentials"}
              </button>
            </>
          )}
        </div>
      </section>

      {/* ── Product Search ─────────────────────────────────────────────────── */}
      {credStatus.configured && (
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Product Search
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Search the supplier website to find product URLs for ingredient
              mapping. Set the URL on the ingredient–supplier link and mark it
              as Scraper Ready.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by product name or code…"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {isSearching ? "Searching…" : "Search"}
            </button>
          </div>

          {searchError && (
            <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
              {searchError}
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-2">Product</th>
                    <th className="px-4 py-2">Code</th>
                    <th className="px-4 py-2 text-right">Price</th>
                    <th className="px-4 py-2">Pack Size</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {searchResults.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {p.productName}
                      </td>
                      <td className="px-4 py-2 text-gray-500 font-mono text-xs">
                        {p.productCode ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900">
                        ${p.purchasePrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {p.purchaseQuantity} {p.purchaseUnit}
                      </td>
                      <td className="px-4 py-2">
                        {p.isAvailable === false ? (
                          <span className="text-xs text-red-600 font-medium">
                            Unavailable
                          </span>
                        ) : (
                          <span className="text-xs text-green-600 font-medium">
                            Available
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isSearching && searchResults.length === 0 && searchQuery && !searchError && (
            <p className="text-sm text-gray-500">No products found.</p>
          )}
        </section>
      )}

      {/* ── Manual Sync ─────────────────────────────────────────────────────── */}
      {credStatus.configured && (
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Manual Sync
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Trigger a scraper sync now. The scraper will log in to the
              supplier website and update prices for all ingredient links marked
              as{" "}
              <span className="font-medium text-gray-700">Scraper Ready</span>.
            </p>
          </div>

          {syncMessage && (
            <div
              className={`px-4 py-3 rounded-lg text-sm font-medium ${
                syncMessage.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {syncMessage.text}
            </div>
          )}

          <button
            onClick={handleSync}
            disabled={isLoading || isSyncing}
            className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSyncing ? "Syncing…" : "Run Scraper Sync"}
          </button>
        </section>
      )}

      {/* ── Sync History ─────────────────────────────────────────────────────── */}
      {credStatus.configured && (
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Sync History
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Recent scraper sync runs for this supplier.
            </p>
          </div>

          {syncLogs.length === 0 ? (
            <p className="text-sm text-gray-500">No scraper syncs run yet.</p>
          ) : (
            <div className="space-y-2">
              {syncLogs.map((log) => (
                <div
                  key={log.id}
                  className="border border-gray-100 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => handleToggleLogDetail(log.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <SyncStatusBadge status={log.status} />
                      <span className="text-sm text-gray-700">
                        {new Date(log.startedAt).toLocaleString("en-NZ")}
                      </span>
                      <span className="text-xs text-gray-400">
                        {log.successLinks}/{log.totalLinks} updated
                        {log.errorLinks > 0 && (
                          <span className="text-red-500 ml-1">
                            · {log.errorLinks} error{log.errorLinks !== 1 ? "s" : ""}
                          </span>
                        )}
                        {log.skippedLinks > 0 && (
                          <span className="text-yellow-600 ml-1">
                            · {log.skippedLinks} skipped
                          </span>
                        )}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {expandedLogId === log.id ? "▲" : "▼"}
                    </span>
                  </button>

                  {expandedLogId === log.id && (
                    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                      {isLoadingDetail ? (
                        <p className="text-xs text-gray-500">Loading…</p>
                      ) : logDetail ? (
                        <div className="space-y-1">
                          {log.errorSummary && (
                            <p className="text-xs text-red-600 mb-2">
                              {log.errorSummary}
                            </p>
                          )}
                          {logDetail.logEntries.map((e) => (
                            <div
                              key={e.id}
                              className={`text-xs font-mono flex gap-2 ${
                                e.level === "error"
                                  ? "text-red-600"
                                  : e.level === "warning"
                                    ? "text-yellow-700"
                                    : "text-gray-600"
                              }`}
                            >
                              <span className="shrink-0 text-gray-400">
                                {new Date(e.createdAt).toLocaleTimeString(
                                  "en-NZ"
                                )}
                              </span>
                              <span>[{e.level.toUpperCase()}]</span>
                              <span>{e.message}</span>
                            </div>
                          ))}
                          {logDetail.logEntries.length === 0 && (
                            <p className="text-xs text-gray-500">
                              No log entries.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
