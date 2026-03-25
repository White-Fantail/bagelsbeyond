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
  const [csvText, setCsvText] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("CSV 파일만 업로드할 수 있습니다 (.csv)");
      return;
    }
    setFileName(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText((ev.target?.result as string) ?? "");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName || !csvText.trim()) {
      setError("CSV 파일을 선택하거나 내용을 입력해주세요");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, csvText }),
      });

      if (!res.ok) {
        const json = await res.json() as { message?: string };
        throw new Error(json.message ?? "가져오기 작업 생성에 실패했습니다");
      }

      const saved = await res.json() as ImportJob;
      router.push(`/imports/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">새 CSV 가져오기</h1>
        <p className="text-gray-500 mt-1">내부 매출 데이터 CSV 파일을 업로드하세요.</p>
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
            <p className="font-semibold mb-1">CSV 파일 형식</p>
            <p className="text-xs">필수 컬럼: <code className="bg-amber-100 px-1 rounded">date</code></p>
            <p className="text-xs mt-0.5">
              선택 컬럼: bagelsBaked, bagelsLeft, storeSales, uberSales, doordashSales, otherSales, notes
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="shrink-0 px-3 py-1.5 bg-amber-600 text-white text-xs rounded-md hover:bg-amber-700 transition-colors"
          >
            📥 템플릿 다운로드
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* File Upload */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">CSV 파일 업로드</h2>
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
              CSV 파일을 드래그하거나 클릭하여 선택
            </p>
            <label className="cursor-pointer px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors">
              파일 선택
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleInputChange}
                className="hidden"
              />
            </label>
            {fileName && (
              <p className="mt-3 text-sm text-gray-700 font-medium">선택됨: {fileName}</p>
            )}
          </div>
        </div>

        {/* Preview */}
        {csvText && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">미리보기</h2>
            <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap bg-gray-50 rounded p-3 max-h-48 overflow-y-auto">
              {csvText.split("\n").slice(0, 10).join("\n")}
              {csvText.split("\n").length > 10 && "\n..."}
            </pre>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting || !fileName || !csvText.trim()}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 font-medium transition-colors"
          >
            {isSubmitting ? "처리 중..." : "📤 업로드 및 검증"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
}
