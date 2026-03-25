"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewImportPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [rawText, setRawText] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      // If text file, read content
      if (file.type === "text/plain") {
        const reader = new FileReader();
        reader.onload = (ev) => setRawText((ev.target?.result as string) ?? "");
        reader.readAsText(file);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setFileName(file.name);
      if (file.type === "text/plain") {
        const reader = new FileReader();
        reader.onload = (ev) => setRawText((ev.target?.result as string) ?? "");
        reader.readAsText(file);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName) {
      setError("파일명을 입력하거나 파일을 선택해주세요");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceFileName: fileName, rawText: rawText || undefined }),
      });

      if (!res.ok) {
        const json = await res.json() as { message?: string };
        throw new Error(json.message ?? "가져오기 작업 생성에 실패했습니다");
      }

      const saved = await res.json() as { id: string };
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
        <h1 className="text-2xl font-bold text-gray-900">새 OCR 가져오기</h1>
        <p className="text-gray-500 mt-1">달력 사진 또는 텍스트 파일을 업로드하세요.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* File Upload */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">파일 업로드</h2>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver ? "border-purple-400 bg-purple-50" : "border-gray-300 hover:border-gray-400"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <p className="text-4xl mb-2">📷</p>
            <p className="text-sm text-gray-600 mb-3">
              이미지 또는 텍스트 파일을 드래그하거나 클릭하여 선택
            </p>
            <label className="cursor-pointer px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors">
              파일 선택
              <input
                type="file"
                accept="image/*,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {fileName && (
              <p className="mt-3 text-sm text-gray-700 font-medium">선택됨: {fileName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              파일명 (직접 입력 가능)
            </label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="예: calendar_2024_jan.jpg"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Raw Text Input */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">텍스트 직접 입력</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                OCR 원문을 직접 붙여넣기할 수 있습니다 (선택사항)
              </p>
            </div>
          </div>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={6}
            placeholder={`형식 예시:\n2024-01-15 baked=80 left=5 store=250.00 uber=80.00 doordash=50.00 other=10.00\n2024-01-16 baked=90 left=8 store=280.00 uber=90.00`}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <strong>참고:</strong> 현재 단계에서 이미지 OCR 자동 인식은 준비 중입니다.
          텍스트 형식으로 직접 입력하거나, 이미지 파일 업로드 후 추후 OCR 처리가 가능합니다.
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting || !fileName}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 font-medium transition-colors"
          >
            {isSubmitting ? "업로드 중..." : "📤 업로드 및 처리"}
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
