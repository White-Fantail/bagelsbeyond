"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { OcrImportJob, OcrImportItem } from "@/types";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "대기중", color: "bg-yellow-100 text-yellow-700" },
  processing: { label: "처리중", color: "bg-blue-100 text-blue-700" },
  completed: { label: "완료", color: "bg-green-100 text-green-700" },
  failed: { label: "실패", color: "bg-red-100 text-red-700" },
  reviewed: { label: "검토완료", color: "bg-purple-100 text-purple-700" },
};

const REVIEW_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "검토중", color: "bg-yellow-100 text-yellow-700" },
  approved: { label: "승인됨", color: "bg-green-100 text-green-700" },
  rejected: { label: "거절됨", color: "bg-red-100 text-red-700" },
};

export default function ImportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<(OcrImportJob & { items: OcrImportItem[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/imports/${id}`)
      .then((r) => r.json())
      .then((data) => { setJob(data as OcrImportJob & { items: OcrImportItem[] }); setLoading(false); })
      .catch(() => { setError("데이터를 불러오는데 실패했습니다"); setLoading(false); });
  }, [id]);

  const handleItemAction = async (itemId: string, action: "approve" | "reject") => {
    setActionLoading(itemId);
    try {
      const res = await fetch(`/api/imports/${id}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const json = await res.json() as { message?: string };
        throw new Error(json.message ?? "처리에 실패했습니다");
      }
      // Refresh job data
      const updated = await fetch(`/api/imports/${id}`).then((r) => r.json());
      setJob(updated as OcrImportJob & { items: OcrImportItem[] });
    } catch (err) {
      alert(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">로딩 중...</div>;
  if (error || !job) return (
    <div className="text-center py-12">
      <p className="text-red-500">{error ?? "작업을 찾을 수 없습니다"}</p>
      <Link href="/imports" className="mt-4 inline-block text-purple-600 hover:underline">목록으로</Link>
    </div>
  );

  const statusInfo = STATUS_LABELS[job.status] ?? { label: job.status, color: "bg-gray-100 text-gray-700" };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{job.sourceFileName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            <span className="text-sm text-gray-500">
              {new Date(job.createdAt).toLocaleString("ko-KR")}
            </span>
          </div>
        </div>
        <Link
          href="/imports"
          className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
        >
          목록
        </Link>
      </div>

      {job.errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 text-sm">
          오류: {job.errorMessage}
        </div>
      )}

      {/* Raw Text */}
      {job.rawText && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">OCR 원문</h2>
          <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap bg-gray-50 rounded p-3 max-h-48 overflow-y-auto">
            {job.rawText}
          </pre>
        </div>
      )}

      {/* Items */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            파싱된 항목 ({job.items.length}건)
          </h2>
        </div>

        {job.items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>파싱된 항목이 없습니다.</p>
            <p className="text-xs mt-1">텍스트 형식으로 데이터를 입력하면 자동으로 파싱됩니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {job.items.map((item) => {
              const reviewInfo = REVIEW_LABELS[item.reviewStatus] ?? { label: item.reviewStatus, color: "bg-gray-100 text-gray-700" };
              const isPending = item.reviewStatus === "pending";
              return (
                <div key={item.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {item.detectedDate
                            ? new Date(item.detectedDate).toLocaleDateString("ko-KR")
                            : "날짜 미인식"}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${reviewInfo.color}`}>
                          {reviewInfo.label}
                        </span>
                        {item.confidenceScore != null && (
                          <span className="text-xs text-gray-400">
                            신뢰도 {Math.round(item.confidenceScore * 100)}%
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-3">
                        {item.extractedBagelsBaked != null && <span>구운 베이글: {item.extractedBagelsBaked}개</span>}
                        {item.extractedBagelsLeft != null && <span>남은 베이글: {item.extractedBagelsLeft}개</span>}
                        {item.extractedStoreSales != null && <span>매장: ${item.extractedStoreSales.toFixed(2)}</span>}
                        {item.extractedUberSales != null && <span>우버: ${item.extractedUberSales.toFixed(2)}</span>}
                        {item.extractedDoordashSales != null && <span>도어대쉬: ${item.extractedDoordashSales.toFixed(2)}</span>}
                      </div>
                      {item.linkedDailyRecordId && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ 연결된 기록:{" "}
                          <Link href={`/sales/${item.linkedDailyRecordId}`} className="underline">
                            보기
                          </Link>
                        </p>
                      )}
                    </div>
                    {isPending && (
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleItemAction(item.id, "approve")}
                          disabled={actionLoading === item.id}
                          className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => handleItemAction(item.id, "reject")}
                          disabled={actionLoading === item.id}
                          className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
                        >
                          거절
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Link
          href="/imports/new"
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm"
        >
          새 가져오기
        </Link>
        <button
          onClick={() => router.push("/imports")}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm"
        >
          목록으로
        </button>
      </div>
    </div>
  );
}
