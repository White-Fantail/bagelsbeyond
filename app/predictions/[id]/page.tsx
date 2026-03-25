import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { comparePredictedVsActual } from "@/lib/prediction-utils";
import type { DailyRecord, SalesPrediction } from "@/types";

const METHOD_LABELS: Record<string, string> = {
  rule_based_v1: "규칙 기반 v1",
  weighted_v1: "가중치 기반 v1",
  manual: "수동 입력",
};

async function getPredictionDetail(id: string) {
  try {
    const prediction = await prisma.salesPrediction.findUnique({
      where: { id },
      include: { factorSnapshots: { orderBy: { impactScore: "desc" } } },
    });

    if (!prediction) return null;

    const targetDate = new Date(prediction.targetDate);
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    const actualRecord = await prisma.dailyRecord.findFirst({
      where: { date: { gte: start, lte: end } },
    }) as DailyRecord | null;

    return { prediction: prediction as SalesPrediction, actualRecord };
  } catch {
    return null;
  }
}

export default async function PredictionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPredictionDetail(id);

  if (!data) notFound();

  const { prediction, actualRecord } = data;
  const comparison = actualRecord ? comparePredictedVsActual(prediction, actualRecord) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            예측 상세 — {formatDate(prediction.targetDate)}
          </h1>
          <p className="text-gray-500 mt-1">
            방식: {METHOD_LABELS[prediction.method] ?? prediction.method} · 생성:{" "}
            {formatDate(prediction.createdAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/predictions/new`}
            className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            재실행
          </Link>
          <Link
            href="/predictions"
            className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            목록
          </Link>
        </div>
      </div>

      {/* Prediction Result Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <ResultCard title="예상 총매출" value={formatCurrency(prediction.predictedSales)} />
        <ResultCard title="예상 판매 베이글" value={`${prediction.predictedBagelsSold}개`} />
        <ResultCard title="추천 생산량" value={`${prediction.recommendedBagelsToBake}개`} />
        <ResultCard title="예상 잔여량" value={`${prediction.predictedLeftovers}개`} />
      </div>

      {prediction.confidenceScore != null && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">신뢰도</span>
            <span className="text-sm font-bold text-blue-700">{prediction.confidenceScore}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full"
              style={{ width: `${prediction.confidenceScore}%` }}
            />
          </div>
          {prediction.notes && (
            <p className="text-xs text-gray-500 mt-2">{prediction.notes}</p>
          )}
        </div>
      )}

      {/* Factor Snapshots */}
      {prediction.factorSnapshots && prediction.factorSnapshots.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">반영된 요인</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">요인</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">값</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">가중치</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">영향값</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {prediction.factorSnapshots.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-2 text-sm text-gray-900">{f.factorLabel}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">{f.factorValue}</td>
                  <td className="px-4 py-2 text-sm text-right">
                    <span className={`font-medium ${f.appliedWeight >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {f.appliedWeight >= 0 ? "+" : ""}{(f.appliedWeight * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-right">
                    <span className={f.impactScore >= 0 ? "text-green-600" : "text-red-600"}>
                      {f.impactScore >= 0 ? "+" : ""}{formatCurrency(f.impactScore)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Actual vs Predicted Comparison */}
      {comparison && (
        <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-blue-100 bg-blue-50">
            <h2 className="text-sm font-semibold text-blue-800">예측 vs 실제 비교</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            <CompareRow
              label="총매출"
              predicted={formatCurrency(comparison.predictedSales)}
              actual={formatCurrency(comparison.actualSales)}
              errorPct={comparison.salesErrorPct}
            />
            <CompareRow
              label="판매 베이글"
              predicted={`${comparison.predictedBagelsSold}개`}
              actual={`${comparison.actualBagelsSold}개`}
              errorPct={comparison.bagelsErrorPct}
            />
          </div>
        </div>
      )}

      {!actualRecord && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-sm text-gray-500">
            이 날짜({formatDate(prediction.targetDate)})의 실제 매출 기록이 없습니다.
          </p>
          <Link
            href="/sales/new"
            className="mt-2 inline-block text-sm text-amber-600 hover:underline"
          >
            매출 입력하기 →
          </Link>
        </div>
      )}
    </div>
  );
}

function ResultCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500">{title}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function CompareRow({
  label,
  predicted,
  actual,
  errorPct,
}: {
  label: string;
  predicted: string;
  actual: string;
  errorPct: number;
}) {
  const isPositive = errorPct >= 0;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-sm text-gray-600">예측: {predicted}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium text-gray-900">실제: {actual}</span>
        <span className={`text-xs ${isPositive ? "text-green-600" : "text-red-600"}`}>
          ({isPositive ? "+" : ""}{errorPct.toFixed(1)}%)
        </span>
      </div>
    </div>
  );
}
