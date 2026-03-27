"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { ImportJob, ImportRow } from "@/types";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:    { label: "Pending", color: "bg-yellow-100 text-yellow-700" },
  validating: { label: "Validating", color: "bg-blue-100 text-blue-700" },
  ready:      { label: "Ready", color: "bg-green-100 text-green-700" },
  imported:   { label: "Imported", color: "bg-purple-100 text-purple-700" },
  failed:     { label: "Failed",     color: "bg-red-100 text-red-700" },
};

const ROW_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:  { label: "Pending", color: "bg-yellow-100 text-yellow-700" },
  valid:    { label: "Valid", color: "bg-green-100 text-green-700" },
  invalid:  { label: "Error",     color: "bg-red-100 text-red-700" },
  imported: { label: "Completed",     color: "bg-purple-100 text-purple-700" },
  skipped:  { label: "Skipped",   color: "bg-gray-100 text-gray-700" },
};

type ExternalCollectResult = {
  totalDates?: number;
  processedDates?: number;
  failedDates?: number;
  errors?: string[];
};

type ImportResult = {
  successRows: number;
  failedRows: number;
  skippedRows: number;
  errors: { rowNumber: number; error: string }[];
  externalCollect?: ExternalCollectResult;
};

export default function ImportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<(ImportJob & { rows: ImportRow[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [hasAutoCollected, setHasAutoCollected] = useState(false);

  const fetchJob = () =>
    fetch(`/api/imports/${id}`)
      .then((r) => r.json())
      .then((data) => setJob(data as ImportJob & { rows: ImportRow[] }))
      .catch(() => setError("Failed to load data"));

  useEffect(() => {
    fetchJob().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    setImportResult(null);
    try {
      const res = await fetch(`/api/imports/${id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overwrite }),
      });
      const data = await res.json() as ImportResult & { message?: string };
      if (!res.ok) throw new Error(data.message ?? "Import failed");

      // Auto-trigger external factor collection for imported dates
      let externalCollect: ExternalCollectResult | undefined;
      if (data.successRows > 0) {
        setCollecting(true);
        try {
          const extRes = await fetch(`/api/imports/${id}/collect-external`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          externalCollect = await extRes.json() as ExternalCollectResult;
          setHasAutoCollected(true);
        } catch (err) {
          externalCollect = { errors: [err instanceof Error ? err.message : "External data collection error"] };
        } finally {
          setCollecting(false);
        }
      }

      setImportResult({ ...data, externalCollect });
      await fetchJob();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setImporting(false);
    }
  };

  const handleCollectExternal = async () => {
    setCollecting(true);
    try {
      const res = await fetch(`/api/imports/${id}/collect-external`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json() as { totalDates?: number; processedDates?: number; failedDates?: number; errors?: string[]; message?: string };
      if (!res.ok) throw new Error(data.message ?? "External Data Collection failed");
      const processed = data.processedDates ?? 0;
      const failed = data.failedDates ?? 0;
      const errors = data.errors ?? [];
      alert(`External Data Collection complete: ${processed} Processing${failed > 0 ? `, ${failed} Failed` : ""}${errors.length > 0 ? `\nError: ${errors.slice(0, 3).join("\n")}` : ""}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "External Data Collection failed");
    } finally {
      setCollecting(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (error && !job) return (
    <div className="text-center py-12">
      <p className="text-red-500">{error}</p>
      <Link href="/imports" className="mt-4 inline-block text-purple-600 hover:underline">Back to List</Link>
    </div>
  );
  if (!job) return (
    <div className="text-center py-12">
      <p className="text-gray-500">Task not found</p>
      <Link href="/imports" className="mt-4 inline-block text-purple-600 hover:underline">Back to List</Link>
    </div>
  );

  const statusInfo = STATUS_LABELS[job.status] ?? { label: job.status, color: "bg-gray-100 text-gray-700" };
  const validRows = job.rows.filter((r) => r.status === "valid").length;
  const canImport = (job.status === "ready" || job.status === "validating") && validRows > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{job.fileName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            <span className="text-sm text-gray-500">
              Total {job.totalRows} rows · Valid {validRows} rows
            </span>
          </div>
        </div>
        <Link
          href="/imports"
          className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
        >
          List
        </Link>
      </div>

      {job.errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 text-sm">
          Error: {job.errorMessage}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 text-sm">
          {error}
        </div>
      )}

      {importResult && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-md p-4 text-sm space-y-1">
          <p className="font-semibold">import Completed</p>
          <p>Success: {importResult.successRows}items · Failed: {importResult.failedRows}items · Skipped: {importResult.skippedRows}</p>
          {importResult.errors.length > 0 && (
            <ul className="mt-1 text-xs list-disc list-inside text-red-600">
              {importResult.errors.slice(0, 5).map((e) => (
                <li key={e.rowNumber}>Rows {e.rowNumber}: {e.error}</li>
              ))}
            </ul>
          )}
          {importResult.externalCollect && (
            <div className="mt-2 pt-2 border-t border-green-200 text-xs text-blue-700">
              <p className="font-semibold">Automatic External Data Collection</p>
              {collecting ? (
                <p>Collecting...</p>
              ) : (
                <p>
                  Target dates: {importResult.externalCollect.totalDates ?? 0} ·{" "}
                  Processed: {importResult.externalCollect.processedDates ?? 0}
                  {(importResult.externalCollect.failedDates ?? 0) > 0 &&
                    ` · Failed: ${importResult.externalCollect.failedDates}`}
                </p>
              )}
              {importResult.externalCollect.errors && importResult.externalCollect.errors.length > 0 && (
                <ul className="text-amber-600 mt-0.5 list-disc list-inside">
                  {importResult.externalCollect.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Import Controls */}
      {canImport && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">import Run</h2>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="rounded border-gray-300"
            />
            Overwrite if date exists (default: skip)
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {importing ? "Importing..." : `✅ ${validRows} Rows import run`}
            </button>
          </div>
        </div>
      )}

      {/* Post-import: re-collect external data */}
      {job.status === "imported" && job.successRows > 0 && !hasAutoCollected && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <p className="text-sm font-semibold text-blue-800">External Data Collect</p>
          <p className="text-xs text-blue-600">You can re-collect Weather, Holiday, and Event data for the imported date range.</p>
          <button
            onClick={handleCollectExternal}
            disabled={collecting}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm transition-colors"
          >
            {collecting ? "Collecting..." : "🌐 Re-collect External Data"}
          </button>
        </div>
      )}

      {/* Rows Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Rows List ({job.rows.length}items)</h2>
        </div>

        {job.rows.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No parsed rows.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Rows</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-right">Bagels Baked</th>
                  <th className="px-3 py-2 text-right">Bagels Left</th>
                  <th className="px-3 py-2 text-right">Store</th>
                  <th className="px-3 py-2 text-right">Uber</th>
                  <th className="px-3 py-2 text-right">DoorDash</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {job.rows.map((row) => {
                  const rowStatus = ROW_STATUS_LABELS[row.status] ?? { label: row.status, color: "bg-gray-100 text-gray-700" };
                  return (
                    <tr key={row.id} className="text-sm hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-500 text-xs">{row.rowNumber}</td>
                      <td className="px-3 py-2 text-gray-900 font-medium">
                        {row.parsedDate
                          ? new Date(row.parsedDate).toLocaleDateString("en-NZ")
                          : <span className="text-red-500 text-xs">No Date</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-700 text-right">{row.parsedBagelsBaked ?? "-"}</td>
                      <td className="px-3 py-2 text-gray-700 text-right">{row.parsedBagelsLeft ?? "-"}</td>
                      <td className="px-3 py-2 text-gray-700 text-right">
                        {row.parsedStoreSales != null ? `$${row.parsedStoreSales.toFixed(2)}` : "-"}
                      </td>
                      <td className="px-3 py-2 text-gray-700 text-right">
                        {row.parsedUberSales != null ? `$${row.parsedUberSales.toFixed(2)}` : "-"}
                      </td>
                      <td className="px-3 py-2 text-gray-700 text-right">
                        {row.parsedDoordashSales != null ? `$${row.parsedDoordashSales.toFixed(2)}` : "-"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${rowStatus.color}`}>
                          {rowStatus.label}
                        </span>
                        {row.validationErrors && (
                          <p className="text-xs text-red-500 mt-0.5">{row.validationErrors}</p>
                        )}
                        {row.linkedDailyRecordId && (
                          <Link
                            href={`/sales/${row.linkedDailyRecordId}`}
                            className="text-xs text-purple-600 hover:underline block mt-0.5"
                          >
                            View Records →
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => router.push("/imports/new")}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm"
        >
          New Import
        </button>
        <button
          onClick={() => router.push("/imports")}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm"
        >
          Back to List
        </button>
      </div>
    </div>
  );
}
