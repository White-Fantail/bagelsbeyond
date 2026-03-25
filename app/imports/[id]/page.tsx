"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { ImportJob, ImportRow } from "@/types";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:    { label: "대기중",   color: "bg-yellow-100 text-yellow-700" },
  validating: { label: "검증중",   color: "bg-blue-100 text-blue-700" },
  ready:      { label: "준비완료", color: "bg-green-100 text-green-700" },
  imported:   { label: "임포트됨", color: "bg-purple-100 text-purple-700" },
  failed:     { label: "실패",     color: "bg-red-100 text-red-700" },
};

const ROW_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:  { label: "대기중",   color: "bg-yellow-100 text-yellow-700" },
  valid:    { label: "유효",     color: "bg-green-100 text-green-700" },
  invalid:  { label: "오류",     color: "bg-red-100 text-red-700" },
  imported: { label: "완료",     color: "bg-purple-100 text-purple-700" },
  skipped:  { label: "건너뜀",   color: "bg-gray-100 text-gray-700" },
};

type ImportResult = {
  successRows: number;
  failedRows: number;
  skippedRows: number;
  errors: { rowNumber: number; error: string }[];
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

  const fetchJob = () =>
    fetch(`/api/imports/${id}`)
      .then((r) => r.json())
      .then((data) => setJob(data as ImportJob & { rows: ImportRow[] }))
      .catch(() => setError("데이터를 불러오는데 실패했습니다"));

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
      if (!res.ok) throw new Error(data.message ?? "임포트에 실패했습니다");
      setImportResult(data);
      await fetchJob();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
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
      if (!res.ok) throw new Error(data.message ?? "외부 데이터 수집에 실패했습니다");
      const processed = data.processedDates ?? 0;
      const failed = data.failedDates ?? 0;
      const errors = data.errors ?? [];
      alert(`외부 데이터 수집 완료: ${processed}건 처리${failed > 0 ? `, ${failed}건 실패` : ""}${errors.length > 0 ? `\n오류: ${errors.slice(0, 3).join("\n")}` : ""}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "외부 데이터 수집에 실패했습니다");
    } finally {
      setCollecting(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">로딩 중...</div>;
  if (error && !job) return (
    <div className="text-center py-12">
      <p className="text-red-500">{error}</p>
      <Link href="/imports" className="mt-4 inline-block text-purple-600 hover:underline">목록으로</Link>
    </div>
  );
  if (!job) return (
    <div className="text-center py-12">
      <p className="text-gray-500">작업을 찾을 수 없습니다</p>
      <Link href="/imports" className="mt-4 inline-block text-purple-600 hover:underline">목록으로</Link>
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
              총 {job.totalRows}행 · 유효 {validRows}행
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

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 text-sm">
          {error}
        </div>
      )}

      {importResult && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-md p-4 text-sm space-y-1">
          <p className="font-semibold">임포트 완료</p>
          <p>성공: {importResult.successRows}건 · 실패: {importResult.failedRows}건 · 건너뜀: {importResult.skippedRows}건</p>
          {importResult.errors.length > 0 && (
            <ul className="mt-1 text-xs list-disc list-inside text-red-600">
              {importResult.errors.slice(0, 5).map((e) => (
                <li key={e.rowNumber}>행 {e.rowNumber}: {e.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Import Controls */}
      {canImport && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">임포트 실행</h2>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="rounded border-gray-300"
            />
            같은 날짜가 있으면 덮어쓰기 (기본: 건너뜀)
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {importing ? "임포트 중..." : `✅ ${validRows}개 행 임포트 실행`}
            </button>
          </div>
        </div>
      )}

      {/* Post-import: collect external data */}
      {job.status === "imported" && job.successRows > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <p className="text-sm font-semibold text-blue-800">외부 데이터 자동 수집</p>
          <p className="text-xs text-blue-600">임포트된 날짜 범위의 날씨·공휴일·이벤트 데이터를 수집할 수 있습니다.</p>
          <button
            onClick={handleCollectExternal}
            disabled={collecting}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm transition-colors"
          >
            {collecting ? "수집 중..." : "🌐 외부 데이터 수집"}
          </button>
        </div>
      )}

      {/* Rows Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">행 목록 ({job.rows.length}건)</h2>
        </div>

        {job.rows.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">파싱된 행이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">행</th>
                  <th className="px-3 py-2 text-left">날짜</th>
                  <th className="px-3 py-2 text-right">구운 베이글</th>
                  <th className="px-3 py-2 text-right">남은 베이글</th>
                  <th className="px-3 py-2 text-right">매장</th>
                  <th className="px-3 py-2 text-right">우버</th>
                  <th className="px-3 py-2 text-right">도어대쉬</th>
                  <th className="px-3 py-2 text-left">상태</th>
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
                          ? new Date(row.parsedDate).toLocaleDateString("ko-KR")
                          : <span className="text-red-500 text-xs">날짜 없음</span>}
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
                            기록 보기 →
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
          새 가져오기
        </button>
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
