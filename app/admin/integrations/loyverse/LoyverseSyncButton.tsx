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
          data.errors?.[0] ?? (data as { message?: string }).message ?? "동기화 중 오류가 발생했습니다"
        );
      } else {
        setResult(data);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류가 발생했습니다");
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
        {loading ? "동기화 중…" : "🔄 Loyverse 전체 동기화"}
      </button>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700 font-medium">동기화 실패</p>
          <p className="text-sm text-red-600 mt-0.5">{error}</p>
        </div>
      )}

      {result && !error && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800">
            {result.status === "success" ? "✓ 동기화 완료" : "⚠ 부분 동기화 완료"}
            {result.finishedAt && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                {new Date(result.finishedAt).toLocaleString("ko-KR")}
              </span>
            )}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            <div className="bg-blue-50 rounded-lg p-2.5 text-center">
              <dt className="text-xs text-blue-600">카테고리</dt>
              <dd className="text-lg font-bold text-blue-700 mt-0.5">{result.categoriesSynced}</dd>
            </div>
            <div className="bg-purple-50 rounded-lg p-2.5 text-center">
              <dt className="text-xs text-purple-600">모디파이어</dt>
              <dd className="text-lg font-bold text-purple-700 mt-0.5">{result.modifiersSynced}</dd>
            </div>
            <div className="bg-violet-50 rounded-lg p-2.5 text-center">
              <dt className="text-xs text-violet-600">모디파이어 옵션</dt>
              <dd className="text-lg font-bold text-violet-700 mt-0.5">{result.modifierOptionsSynced}</dd>
            </div>
            <div className="bg-green-50 rounded-lg p-2.5 text-center">
              <dt className="text-xs text-green-600">상품</dt>
              <dd className="text-lg font-bold text-green-700 mt-0.5">{result.itemsSynced}</dd>
            </div>
            <div className="bg-amber-50 rounded-lg p-2.5 text-center">
              <dt className="text-xs text-amber-600">상품-모디파이어 연결</dt>
              <dd className="text-lg font-bold text-amber-700 mt-0.5">{result.itemModifierLinksSynced}</dd>
            </div>
            <div className="bg-sky-50 rounded-lg p-2.5 text-center">
              <dt className="text-xs text-sky-600">Variants</dt>
              <dd className="text-lg font-bold text-sky-700 mt-0.5">{result.variantsSynced}</dd>
            </div>
            <div className="bg-teal-50 rounded-lg p-2.5 text-center">
              <dt className="text-xs text-teal-600">재고 수준</dt>
              <dd className="text-lg font-bold text-teal-700 mt-0.5">{result.inventoryLevelsSynced}</dd>
            </div>
            {result.errorCount > 0 && (
              <div className="bg-red-50 rounded-lg p-2.5 text-center">
                <dt className="text-xs text-red-600">오류</dt>
                <dd className="text-lg font-bold text-red-700 mt-0.5">{result.errorCount}</dd>
              </div>
            )}
          </div>

          {/* Modifier link diagnostics — split into HTTP raw / JSON.parse / parsed / final stages */}
          <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3 space-y-2.5">
            <p className="text-xs font-semibold text-amber-800">상품-모디파이어 연결 진단</p>

            {/* Stage A: HTTP 원문 응답 */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-700">[A] HTTP 원문 응답</p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-amber-700">
                <li>
                  <span className="font-medium">Mock 모드:</span>{" "}
                  {result.loyverseMock ? "예 (실제 HTTP 없음)" : "아니오"}
                </li>
                <li>
                  <span className="font-medium">HTTP 상태:</span>{" "}
                  {result.itemsFetchHttpStatus ?? "N/A"}
                </li>
                <li className="col-span-2">
                  <span className="font-medium">요청 URL:</span>{" "}
                  {result.itemsFetchUrl ?? "N/A"}
                </li>
                <li>
                  <span className="font-medium">원문에 "modifier_ids" 포함:</span>{" "}
                  {result.rawBodyContainsModifiersIds === null
                    ? "N/A (mock)"
                    : result.rawBodyContainsModifiersIds
                    ? "✓ 있음"
                    : "✗ 없음"}
                </li>
                <li>
                  <span className="font-medium">Fallback 사용:</span> 아니오
                </li>
                <li>
                  <span className="font-medium">Cache 사용:</span> 아니오
                </li>
              </ul>
            </div>

            {/* Stage B: JSON.parse 직후 */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-700">[B] JSON.parse 직후 (deleted_at 필터 전)</p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-amber-700">
                <li>
                  <span className="font-medium">modifier_ids 있음:</span>{" "}
                  {result.rawItemsWithModifiersIds ?? 0}
                </li>
                <li>
                  <span className="font-medium">modifier_ids 없음:</span>{" "}
                  {result.rawItemsWithoutModifiersIds ?? 0}
                </li>
              </ul>
            </div>

            {/* Stage C: Parsed DTO (활성 상품만) */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-700">[C] Parsed DTO (활성 상품만)</p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-amber-700">
                <li>
                  <span className="font-medium">modifier_ids 필드 없음:</span>{" "}
                  {result.itemsWithoutModifierField ?? 0}
                </li>
                <li>
                  <span className="font-medium">modifier_ids 빈 배열:</span>{" "}
                  {result.itemsWithEmptyModifiers ?? 0}
                </li>
              </ul>
            </div>

            {/* Stage D: 링크 생성 결과 */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-700">[D] 링크 생성 결과</p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-amber-700">
                <li>
                  <span className="font-medium">modifier 매칭 실패:</span>{" "}
                  {result.modifierNotFoundLocally ?? 0}
                </li>
                <li>
                  <span className="font-medium">링크 생성 성공:</span>{" "}
                  {result.itemModifierLinksSynced ?? 0}
                </li>
                <li>
                  <span className="font-medium">링크 생성 실패:</span>{" "}
                  {result.linkInsertErrors ?? 0}
                </li>
              </ul>
            </div>
          </div>

          {result.errors && result.errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
              <p className="text-xs font-medium text-red-700">오류 상세 (최대 5건)</p>
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
