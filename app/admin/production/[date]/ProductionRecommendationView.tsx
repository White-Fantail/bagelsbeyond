"use client";

import { useState } from "react";
import type { ProductionRecommendationResult } from "@/lib/services/production-recommendation";

interface Props {
  recommendation: ProductionRecommendationResult;
  date: string;
}

export default function ProductionRecommendationView({ recommendation, date }: Props) {
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const {
    confirmedQty,
    subscriptionQty,
    predictedExtraQty,
    safetyBufferQty,
    existingStockQty,
    recommendedTotalQty,
    productRecommendations,
  } = recommendation;

  async function handleApply() {
    if (productRecommendations.length === 0) return;
    setApplying(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/production/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          productRecommendations: productRecommendations.map((p) => ({
            productId: p.productId,
            recommendedQty: p.recommendedQty,
          })),
        }),
      });

      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setMessageType("error");
        setMessage(data.message ?? "저장 실패");
      } else {
        setMessageType("success");
        setMessage(data.message ?? "생산 계획이 저장되었습니다.");
      }
    } catch {
      setMessageType("error");
      setMessage("저장 중 오류가 발생했습니다.");
    } finally {
      setApplying(false);
    }
  }

  const totalConfirmed = productRecommendations.reduce((s, p) => s + p.confirmedQty, 0);
  const totalPredicted = productRecommendations.reduce((s, p) => s + p.predictedQty, 0);
  const totalRecommended = productRecommendations.reduce((s, p) => s + p.recommendedQty, 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <SummaryCard label="확정 주문" value={confirmedQty} color="blue" />
        <SummaryCard label="구독 수량" value={subscriptionQty} color="purple" />
        <SummaryCard label="예측 추가 수요" value={predictedExtraQty} color="amber" />
        <SummaryCard label="안전 버퍼" value={safetyBufferQty} color="orange" />
        <SummaryCard label="기존 재고 (차감)" value={existingStockQty} color="green" negative />
        <SummaryCard label="추천 총 생산량" value={recommendedTotalQty} color="amber" highlight />
      </div>

      {/* Formula */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">📐 계산 공식</p>
        <p>
          추천 생산량 = 확정 주문({confirmedQty}) + 예측 추가 수요({predictedExtraQty}) + 안전
          버퍼({safetyBufferQty}) − 기존 재고({existingStockQty}) ={" "}
          <strong>{recommendedTotalQty}개</strong>
        </p>
      </div>

      {/* Product recommendations table */}
      {productRecommendations.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">상품별 추천 생산량</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              최근 4주 판매 비율 기반으로 상품별 생산량을 분배합니다
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <th className="px-6 py-3 text-left">상품명</th>
                  <th className="px-6 py-3 text-right">확정 수량</th>
                  <th className="px-6 py-3 text-right">예측 수량</th>
                  <th className="px-6 py-3 text-right font-semibold text-amber-700">추천 수량</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {productRecommendations.map((p) => (
                  <tr key={p.productId} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{p.productName}</td>
                    <td className="px-6 py-3 text-right text-blue-600">{p.confirmedQty}</td>
                    <td className="px-6 py-3 text-right text-amber-600">{p.predictedQty}</td>
                    <td className="px-6 py-3 text-right font-bold text-amber-700">
                      {p.recommendedQty}
                    </td>
                  </tr>
                ))}
                <tr className="bg-amber-50 font-semibold">
                  <td className="px-6 py-3 text-gray-900">합계</td>
                  <td className="px-6 py-3 text-right text-blue-700">{totalConfirmed}</td>
                  <td className="px-6 py-3 text-right text-amber-700">{totalPredicted}</td>
                  <td className="px-6 py-3 text-right text-amber-800 font-bold">
                    {totalRecommended}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500 text-sm">
          등록된 상품이 없습니다. 먼저 상품을 등록해주세요.
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={handleApply}
          disabled={applying || productRecommendations.length === 0}
          className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
        >
          {applying ? "저장 중..." : "추천 생산량 적용 (DailyInventory 업데이트)"}
        </button>
        {message && (
          <span
            className={
              messageType === "success" ? "text-green-600 text-sm" : "text-red-500 text-sm"
            }
          >
            {message}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

const colorMap: Record<string, string> = {
  blue: "border-blue-200",
  purple: "border-purple-200",
  amber: "border-amber-200",
  orange: "border-orange-200",
  green: "border-green-200",
};

const textColorMap: Record<string, string> = {
  blue: "text-blue-700",
  purple: "text-purple-700",
  amber: "text-amber-700",
  orange: "text-orange-700",
  green: "text-green-700",
};

function SummaryCard({
  label,
  value,
  color,
  negative,
  highlight,
}: {
  label: string;
  value: number;
  color: string;
  negative?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-xl border p-4 ${
        highlight ? "border-amber-400 shadow-md" : (colorMap[color] ?? "border-gray-200")
      }`}
    >
      <p className={`text-xs text-gray-500 mb-1 ${highlight ? "font-semibold" : ""}`}>{label}</p>
      <p className={`text-2xl font-bold ${highlight ? "text-amber-600" : (textColorMap[color] ?? "text-gray-900")}`}>
        {negative && value > 0 ? "−" : ""}
        {value}
        <span className="text-sm font-normal ml-0.5">개</span>
      </p>
    </div>
  );
}
