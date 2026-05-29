"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateCsvTemplate } from "@/lib/csv-parser";
import type { ImportJob } from "@/types";

export default function NewImportPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileCsvText, setFileCsvText] = useState(""); // from file upload
  const [pastedCsvText, setPastedCsvText] = useState(""); // from textarea
  const [dragOver, setDragOver] = useState(false);
  const [templateCopied, setTemplateCopied] = useState(false);

  // textarea content takes priority over uploaded file
  const effectiveCsvText = pastedCsvText.trim() || fileCsvText;
  const isReady = effectiveCsvText.trim().length > 0;

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Only CSV files can be uploaded (.csv)");
      return;
    }
    setFileName(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => setFileCsvText((ev.target?.result as string) ?? "");
    reader.readAsText(file, "utf-8");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e.target.files?.[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileChange(e.dataTransfer.files?.[0]);
  };

  const handleDownloadTemplate = () => {
    const content = generateCsvTemplate();
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bagels_beyond_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyTemplate = async () => {
    const template = generateCsvTemplate();
    try {
      await navigator.clipboard.writeText(template);
      setTemplateCopied(true);
      setTimeout(() => setTemplateCopied(false), 2000);
    } catch {
      setError("Clipboard copy failed. Please use the template download instead.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReady) {
      setError("Select a CSV file or paste CSV content in the text area below");
      return;
    }

    // textarea takes priority; auto-generate fileName when using paste
    const finalCsvText = pastedCsvText.trim() || fileCsvText;
    const finalFileName = pastedCsvText.trim()
      ? `paste_${new Date().toISOString().slice(0, 10)}.csv`
      : fileName;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: finalFileName, csvText: finalCsvText }),
      });

      if (!res.ok) {
        const json = await res.json() as { message?: string };
        throw new Error(json.message ?? "Failed to create import task");
      }

      const saved = await res.json() as ImportJob;
      router.push(`/imports/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewText = pastedCsvText.trim() || fileCsvText;

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New CSV Import</h1>
        <p className="text-gray-500 mt-1">Upload a CSV file or paste CSV content directly below.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 text-sm">
          {error}
        </div>
      )}

      {/* Template info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold mb-1">CSV File Format</p>
            <p className="text-xs">Required column: <code className="bg-amber-100 px-1 rounded">date</code></p>
            <p className="text-xs mt-0.5">
              Optional columns: bagelsBaked, bagelsLeft, storeSales, uberSales, doordashSales, otherSales, notes
            </p>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 bg-amber-600 text-white text-xs rounded-md hover:bg-amber-700 transition-colors"
            >
              📥 Download Template
            </button>
            <button
              type="button"
              onClick={handleCopyTemplate}
              className="px-3 py-1.5 bg-amber-100 text-amber-800 text-xs rounded-md hover:bg-amber-200 transition-colors border border-amber-300"
            >
              {templateCopied ? "✅ Copied!" : "📋 Copy Template"}
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* File Upload */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">① Upload CSV File</h2>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver ? "border-purple-400 bg-purple-50" : "border-gray-300 hover:border-gray-400"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <p className="text-4xl mb-2">📂</p>
            <p className="text-sm text-gray-600 mb-3">
              Drag or click to select a CSV file
            </p>
            <label className="cursor-pointer px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors">
              Select File
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleInputChange}
                className="hidden"
              />
            </label>
            {fileName && (
              <p className="mt-3 text-sm text-gray-700 font-medium">Selected: {fileName}</p>
            )}
          </div>
        </div>

        {/* Paste CSV */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
          <h2 className="text-base font-semibold text-gray-900">② Paste CSV Content Directly</h2>
          <p className="text-xs text-gray-500">
            You can paste CSV text copied from Excel or a spreadsheet here..
            {pastedCsvText.trim() && (
              <span className="ml-1 text-purple-600 font-medium">This content takes priority over the uploaded file.</span>
            )}
          </p>
          <textarea
            value={pastedCsvText}
            onChange={(e) => setPastedCsvText(e.target.value)}
            placeholder={`date,bagelsBaked,bagelsLeft,storeSales,uberSales,doordashSales,otherSales,notes\n2024-01-15,80,5,250.00,80.00,50.00,10.00,normal weekday\n2024-01-20,100,3,320.00,110.00,70.00,15.00,Sat busy`}
            rows={8}
            className="w-full text-xs font-mono border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-y"
          />
          <p className="text-xs text-gray-400">
            Example header: <code>date,bagelsBaked,bagelsLeft,storeSales,uberSales,doordashSales,otherSales,notes</code>
          </p>
        </div>

        {/* Preview */}
        {previewText && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">
              Preview{pastedCsvText.trim() ? " (pasted content)" : " (uploaded file)"}
            </h2>
            <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap bg-gray-50 rounded p-3 max-h-48 overflow-y-auto">
              {previewText.split("\n").slice(0, 10).join("\n")}
              {previewText.split("\n").length > 10 && "\n..."}
            </pre>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting || !isReady}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 font-medium transition-colors"
          >
            {isSubmitting ? "Processing......" : "📤 Upload and Validate"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
