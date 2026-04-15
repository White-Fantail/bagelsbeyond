"use client";

import { useState, useTransition, useRef } from "react";
import type { PriceImportPreviewResult, PriceImportPreviewRow } from "@/lib/services/priceImportService";

type Mode = "INGREDIENT" | "SUPPLIER_LINK";

type ApplyResult = {
  batchId: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  skippedRows: number;
  errors: Array<{ rowNumber: number; message: string }>;
} | null;

const STATUS_STYLES: Record<string, string> = {
  READY: "bg-green-100 text-green-800",
  WARNING: "bg-yellow-100 text-yellow-800",
  ERROR: "bg-red-100 text-red-800",
  SKIPPED: "bg-gray-100 text-gray-500",
};

export default function PriceImportClient() {
  const [mode, setMode] = useState<Mode>("INGREDIENT");
  const [preview, setPreview] = useState<PriceImportPreviewResult | null>(null);
  const [includeWarnings, setIncludeWarnings] = useState(true);
  const [applyResult, setApplyResult] = useState<ApplyResult>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [isPreviewing, startPreview] = useTransition();
  const [isApplying, startApply] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleDownloadTemplate() {
    window.location.href = `/api/admin/prices/import/template?mode=${mode}`;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewError(null);
    setApplyResult(null);
    setPreview(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const csvText = ev.target?.result as string;
      startPreview(async () => {
        try {
          const res = await fetch("/api/admin/prices/import/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode, csvText, fileName: file.name }),
          });
          const data = await res.json();
          if (!res.ok) {
            setPreviewError(data.message ?? "Failed to preview CSV");
            return;
          }
          setPreview(data.preview);
        } catch {
          setPreviewError("Network error while previewing CSV");
        }
      });
    };
    reader.readAsText(file);
  }

  function handleApply() {
    if (!preview) return;
    setApplyError(null);
    startApply(async () => {
      try {
        const res = await fetch("/api/admin/prices/import/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preview, includeWarnings }),
        });
        const data = await res.json();
        if (!res.ok) {
          setApplyError(data.message ?? "Failed to apply import");
          return;
        }
        setApplyResult(data.result);
        setPreview(null);
        if (fileRef.current) fileRef.current.value = "";
      } catch {
        setApplyError("Network error while applying import");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Mode + Upload */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Import Mode</p>
          <div className="flex gap-4">
            {(["INGREDIENT", "SUPPLIER_LINK"] as Mode[]).map((m) => (
              <label key={m} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value={m}
                  checked={mode === m}
                  onChange={() => { setMode(m); setPreview(null); setApplyResult(null); }}
                  className="accent-amber-500"
                />
                <span className="text-sm text-gray-700">
                  {m === "INGREDIENT" ? "Ingredient mode" : "Supplier Link mode"}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {mode === "INGREDIENT"
              ? "Match rows by ingredientId or ingredient name."
              : "Match rows by supplier name/ID and product code/name."}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleDownloadTemplate}
            className="px-3 py-2 text-sm rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors"
          >
            ↓ Download Template
          </button>
          <label className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer">
            {isPreviewing ? "Parsing…" : "Upload CSV"}
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={handleFileChange}
              disabled={isPreviewing}
            />
          </label>
        </div>

        {previewError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {previewError}
          </div>
        )}
      </div>

      {/* Step 2: Preview */}
      {preview && (
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Ready", value: preview.readyRows, color: "text-green-700 bg-green-50 border-green-200" },
              { label: "Warnings", value: preview.warningRows, color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
              { label: "Errors", value: preview.errorRows, color: "text-red-700 bg-red-50 border-red-200" },
              { label: "Skipped", value: preview.skippedRows, color: "text-gray-600 bg-gray-50 border-gray-200" },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-xl border px-4 py-3 ${color}`}>
                <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>

          {/* Preview table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">Row</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">Status</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">Ingredient</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-600">Current Price</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-600">New Price</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-600">Δ%</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">Unit</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">Note</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.rows.map((row: PriceImportPreviewRow) => (
                    <tr key={row.rowNumber} className={row.status === "ERROR" ? "bg-red-50" : row.status === "WARNING" ? "bg-yellow-50" : ""}>
                      <td className="px-3 py-2 text-gray-400">{row.rowNumber}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[row.status] ?? ""}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-800">{row.ingredientName ?? "—"}</td>
                      <td className="px-3 py-2 text-right text-gray-500">
                        {row.currentPurchasePrice ? `$${row.currentPurchasePrice}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-gray-800">
                        {row.newPurchasePrice ? `$${parseFloat(row.newPurchasePrice).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.deltaPercent != null ? (
                          <span className={parseFloat(row.deltaPercent) > 0 ? "text-red-600" : parseFloat(row.deltaPercent) < 0 ? "text-green-600" : "text-gray-500"}>
                            {parseFloat(row.deltaPercent) > 0 ? "+" : ""}{row.deltaPercent}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{row.newPurchaseUnit ?? "—"}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-xs truncate">{row.note ?? ""}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 max-w-xs">{row.message ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Apply controls */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                checked={includeWarnings}
                onChange={(e) => setIncludeWarnings(e.target.checked)}
                className="accent-amber-500"
              />
              Include warning rows
            </label>
            <button
              onClick={handleApply}
              disabled={isApplying || (preview.readyRows + (includeWarnings ? preview.warningRows : 0)) === 0}
              className="px-5 py-2 rounded-lg bg-amber-500 text-white font-medium text-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isApplying ? "Applying…" : `Apply Import (${preview.readyRows + (includeWarnings ? preview.warningRows : 0)} rows)`}
            </button>
          </div>

          {applyError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {applyError}
            </div>
          )}
        </div>
      )}

      {/* Apply result */}
      {applyResult && (
        <div className={`rounded-xl border px-5 py-4 space-y-2 ${applyResult.errorRows > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
          <p className={`font-medium text-sm ${applyResult.errorRows > 0 ? "text-red-800" : "text-green-800"}`}>
            Import complete
          </p>
          <ul className="text-sm space-y-0.5">
            <li className="text-green-700">✓ {applyResult.successRows} row{applyResult.successRows !== 1 ? "s" : ""} applied</li>
            {applyResult.errorRows > 0 && <li className="text-red-700">✗ {applyResult.errorRows} error{applyResult.errorRows !== 1 ? "s" : ""}</li>}
            {applyResult.skippedRows > 0 && <li className="text-gray-500">— {applyResult.skippedRows} skipped</li>}
          </ul>
          {applyResult.errors.length > 0 && (
            <ul className="text-xs text-red-600 space-y-0.5 mt-2">
              {applyResult.errors.map((e, i) => (
                <li key={i}>Row {e.rowNumber}: {e.message}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-gray-500">Batch ID: {applyResult.batchId}</p>
        </div>
      )}
    </div>
  );
}
