"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CredentialStatus, SyncLogRow } from "@/lib/services/supplierSyncService";
import type { SupplierRow } from "@/lib/services/supplierService";

interface AdapterInfo {
  adapterKey: string;
  displayName: string;
}

interface Props {
  supplier: SupplierRow;
  credentialStatus: CredentialStatus;
  adapters: AdapterInfo[];
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

export default function SupplierApiClient({
  supplier,
  credentialStatus,
  adapters,
  syncLogs: initialSyncLogs,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Credentials form state
  const [credStatus, setCredStatus] = useState<CredentialStatus>(credentialStatus);
  const [selectedAdapterKey, setSelectedAdapterKey] = useState(
    credentialStatus.adapterKey ?? adapters[0]?.adapterKey ?? ""
  );
  const [credFields, setCredFields] = useState<Record<string, string>>({});
  const [credNotes, setCredNotes] = useState(credentialStatus.notes ?? "");
  const [credMessage, setCredMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSavingCreds, setIsSavingCreds] = useState(false);
  const [isDeletingCreds, setIsDeletingCreds] = useState(false);
  const [isTestingCreds, setIsTestingCreds] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ productCode: string; productName: string; purchasePrice: number; purchaseQuantity: number; purchaseUnit: string; isAvailable?: boolean }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Sync state
  const [syncLogs, setSyncLogs] = useState<SyncLogRow[]>(initialSyncLogs);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load adapter details when a new adapter is selected
  function handleAdapterChange(key: string) {
    setSelectedAdapterKey(key);
    setTestResult(null);
    setCredMessage(null);
  }

  async function handleSaveCredentials() {
    if (!selectedAdapterKey) return;
    setIsSavingCreds(true);
    setCredMessage(null);
    setTestResult(null);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplier.id}/credentials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adapterKey: selectedAdapterKey,
          credentials: credFields,
          notes: credNotes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCredMessage({ type: "error", text: data.message ?? "Failed to save credentials" });
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
    if (!confirm("Remove API credentials? This will disable API sync for this supplier.")) return;
    setIsDeletingCreds(true);
    setCredMessage(null);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplier.id}/credentials`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setCredMessage({ type: "error", text: data.message ?? "Failed to delete credentials" });
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

  async function handleTestConnection() {
    setIsTestingCreds(true);
    setTestResult(null);
    try {
      const res = await fetch(
        `/api/admin/suppliers/${supplier.id}/credentials?action=test`,
        { method: "POST" }
      );
      const data = await res.json();
      setTestResult({ ok: data.ok ?? false, message: data.message ?? "Unknown result" });
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
      const res = await fetch(`/api/admin/suppliers/${supplier.id}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, limit: 20 }),
      });
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
    if (!confirm("Run API sync now? This will update ingredient prices from the supplier API.")) return;
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplier.id}/sync`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncMessage({ type: "error", text: data.message ?? "Sync failed" });
      } else {
        const r = data.result;
        setSyncMessage({
          type: r.status === "FAILED" ? "error" : "success",
          text: `Sync complete — ${r.successLinks} updated, ${r.errorLinks} errors, ${r.skippedLinks} skipped`,
        });
        // Refresh sync logs
        const logsRes = await fetch(`/api/admin/suppliers/${supplier.id}/sync?limit=20`);
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

  const isLoading = isPending || isSavingCreds || isDeletingCreds || isSyncing;

  return (
    <div className="space-y-8">
      {/* ── Credential Configuration ───────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">API Credentials</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Connect this supplier to an adapter so prices can be synced automatically.
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
            Adapter
          </label>
          <select
            value={selectedAdapterKey}
            onChange={(e) => handleAdapterChange(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">Select an adapter…</option>
            {adapters.map((a) => (
              <option key={a.adapterKey} value={a.adapterKey}>
                {a.displayName}
              </option>
            ))}
          </select>
        </div>

        {/* Generic credential fields */}
        {selectedAdapterKey && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                API Key <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={credFields["apiKey"] ?? ""}
                onChange={(e) =>
                  setCredFields((prev) => ({ ...prev, apiKey: e.target.value }))
                }
                placeholder={
                  credStatus.configured ? "(leave blank to keep existing)" : 'Enter API key (use "demo" for test)'
                }
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <input
                type="text"
                value={credNotes}
                onChange={(e) => setCredNotes(e.target.value)}
                placeholder="Optional notes about this connection"
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
                onClick={handleTestConnection}
                disabled={isLoading || isTestingCreds}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {isTestingCreds ? "Testing…" : "Test Connection"}
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
            <h2 className="text-base font-semibold text-gray-900">Product Search</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Search the supplier catalogue to find product codes for ingredient mapping.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by name or product code…"
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
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Product Code</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">Price</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">Qty</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Unit</th>
                    <th className="text-center px-4 py-2 font-medium text-gray-600">Available</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {searchResults.map((p) => (
                    <tr key={p.productCode} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-xs text-gray-700">{p.productCode}</td>
                      <td className="px-4 py-2 text-gray-900">{p.productName}</td>
                      <td className="px-4 py-2 text-right font-mono">${p.purchasePrice.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-mono">{p.purchaseQuantity}</td>
                      <td className="px-4 py-2 text-gray-600">{p.purchaseUnit}</td>
                      <td className="px-4 py-2 text-center">
                        {p.isAvailable === false ? (
                          <span className="text-xs text-gray-400">Unavailable</span>
                        ) : (
                          <span className="text-xs text-green-600">✓</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-2">
                Copy the product code into the supplier link&apos;s{" "}
                <strong>Supplier Product Code</strong> field and set syncMode to{" "}
                <strong>API_READY</strong> to enable automatic sync.
              </p>
            </div>
          )}

          {!isSearching && searchResults.length === 0 && searchQuery && !searchError && (
            <p className="text-sm text-gray-400">No products found for &ldquo;{searchQuery}&rdquo;.</p>
          )}
        </section>
      )}

      {/* ── Manual Sync ────────────────────────────────────────────────────── */}
      {credStatus.configured && (
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Manual Sync</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Fetch current pricing for all ingredient links with syncMode set to{" "}
              <strong>API_READY</strong> and a supplier product code. Updates live ingredient
              prices and appends to price history.
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
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSyncing ? "Syncing…" : "Run Sync Now"}
          </button>
        </section>
      )}

      {/* ── Sync Log ──────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Sync History</h2>
        </div>

        {syncLogs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm">No sync runs recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Started</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Links</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Updated</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Errors</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Skipped</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Triggered by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {syncLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <SyncStatusBadge status={log.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(log.startedAt).toLocaleString("en-NZ")}
                    </td>
                    <td className="px-4 py-3 text-right">{log.totalLinks}</td>
                    <td className="px-4 py-3 text-right text-green-700">{log.successLinks}</td>
                    <td className="px-4 py-3 text-right text-red-600">{log.errorLinks}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{log.skippedLinks}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {log.triggeredByUserName ?? "System"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
