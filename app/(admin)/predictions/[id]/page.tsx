import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { comparePredictedVsActual, parsePredictionExplanation } from "@/lib/prediction-utils";
import type { DailyRecord, SalesPrediction, PredictionExplanationItem } from "@/types";
import DeletePredictionButton from "@/components/DeletePredictionButton";

const METHOD_LABELS: Record<string, string> = {
  rule_based_v1: "Rule-based v1",
  rule_based_v2: "Rule-based v2",
  weighted_v1: "Weights-based v1",
  manual: "Manual Enter",
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

    const actualRecord = (await prisma.dailyRecord.findFirst({
      where: { date: { gte: start, lte: end } },
    })) as DailyRecord | null;

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
  const explanation = parsePredictionExplanation(prediction.explanationJson);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Prediction Details — {formatDate(prediction.targetDate)}
          </h1>
          <p className="text-gray-500 mt-1">
            Method: {METHOD_LABELS[prediction.method] ?? prediction.method} · Created:{" "}
            {formatDate(prediction.createdAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/predictions/performance"
            className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            View Performance
          </Link>
          <Link
            href="/predictions"
            className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            List
          </Link>
          <DeletePredictionButton predictionId={prediction.id} />
        </div>
      </div>

      {/* Main Results */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <ResultCard title="Predicted Total Sales" value={formatCurrency(prediction.predictedSales)} highlight />
        <ResultCard title="Predicted Sold Bagels" value={`${prediction.predictedBagelsSold}`} />
        <ResultCard title="Recommended Production" value={`${prediction.recommendedBagelsToBake}`} highlight />
        <ResultCard title="Predicted Remaining" value={`${prediction.predictedLeftovers}`} />
      </div>

      {/* Extended Stats */}
      {(prediction.projectedWasteRate != null || prediction.projectedSellThroughRate != null || prediction.baselineSales != null) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {prediction.baselineSales != null && (
            <MetaCard
              label="Baseline Sales"
              value={formatCurrency(prediction.baselineSales)}
              sub="recent average baselineValue"
            />
          )}
          {prediction.projectedSellThroughRate != null && (
            <MetaCard
              label="Estimated Sell-through Rate"
              value={`${(prediction.projectedSellThroughRate * 100).toFixed(1)}%`}
              sub="vs. Recommended Production"
            />
          )}
          {prediction.projectedWasteRate != null && (
            <MetaCard
              label="Predicted Waste Rate"
              value={`${(prediction.projectedWasteRate * 100).toFixed(1)}%`}
              sub="vs. Recommended Production"
            />
          )}
        </div>
      )}

      {/* Confidence */}
      {prediction.confidenceScore != null && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Predictions Confidence</span>
            <span className={`text-sm font-bold ${prediction.confidenceScore >= 70 ? "text-green-600" : prediction.confidenceScore >= 50 ? "text-yellow-600" : "text-red-600"}`}>
              {prediction.confidenceScore}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${prediction.confidenceScore >= 70 ? "bg-green-500" : prediction.confidenceScore >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
              style={{ width: `${prediction.confidenceScore}%` }}
            />
          </div>
          {prediction.notes && (
            <p className="text-xs text-gray-500 mt-2">{prediction.notes}</p>
          )}
        </div>
      )}

      {/* Explanation */}
      {explanation && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-5">
          <h2 className="text-sm font-semibold text-blue-900 mb-3">💡 Prediction Basis</h2>
          <p className="text-sm text-blue-800 mb-4 font-medium">{explanation.summary}</p>
          <ul className="space-y-2">
            {explanation.items.map((item, i) => (
              <ExplanationItem key={i} item={item} />
            ))}
          </ul>
        </div>
      )}

      {/* Factor Snapshots */}
      {prediction.factorSnapshots && prediction.factorSnapshots.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Impact by Applied Factor</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Factor</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Value</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Weights</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Impact (Sales)</th>
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

      {/* Actual vs Predicted */}
      {comparison && (
        <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-blue-100 bg-blue-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-blue-800">📊 Predictions vs Actual Comparison</h2>
            <AccuracyBadge direction={comparison.direction} label={comparison.label} />
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <CompareRow
                label="Total Sales"
                predicted={formatCurrency(comparison.predictedSales)}
                actual={formatCurrency(comparison.actualSales)}
                error={`${comparison.salesError >= 0 ? "+" : ""}${formatCurrency(comparison.salesError)}`}
                errorPct={comparison.salesErrorPct}
              />
              <CompareRow
                label="Sold Bagels"
                predicted={`${comparison.predictedBagelsSold}`}
                actual={`${comparison.actualBagelsSold}`}
                error={`${comparison.bagelsError >= 0 ? "+" : ""}${comparison.bagelsError}`}
                errorPct={comparison.bagelsErrorPct}
              />
              <CompareRow
                label="Remaining Bagels"
                predicted={`${comparison.predictedLeftovers}`}
                actual={`${comparison.actualLeftovers}`}
                error={`${comparison.leftoversError >= 0 ? "+" : ""}${comparison.leftoversError}`}
                errorPct={comparison.predictedLeftovers > 0 ? comparison.leftoversError / comparison.predictedLeftovers * 100 : 0}
              />
            </div>
          </div>
        </div>
      )}

      {!actualRecord && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-sm text-gray-500">
            No actual sales records for this date ({formatDate(prediction.targetDate)}).
          </p>
          <Link
            href="/sales/new"
            className="mt-2 inline-block text-sm text-amber-600 hover:underline"
          >
            Enter Sales →
          </Link>
        </div>
      )}
    </div>
  );
}

function ResultCard({ title, value, highlight }: { title: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-white"}`}>
      <p className="text-xs text-gray-500">{title}</p>
      <p className={`text-xl font-bold mt-1 ${highlight ? "text-blue-700" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function MetaCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-base font-semibold text-gray-800 mt-0.5">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

function ExplanationItem({ item }: { item: PredictionExplanationItem }) {
  const icons: Record<string, string> = {
    baseline: "📊",
    weekday: "📅",
    weather: "🌧️",
    holiday: "🎉",
    event: "🎪",
    school: "🏫",
    news: "📰",
    production: "🥯",
    info: "ℹ️",
  };
  return (
    <li className="flex items-start gap-2 text-sm text-blue-700">
      <span className="text-base leading-5 shrink-0">{icons[item.type] ?? "•"}</span>
      <span>{item.text}</span>
    </li>
  );
}

function CompareRow({
  label,
  predicted,
  actual,
  error,
  errorPct,
}: {
  label: string;
  predicted: string;
  actual: string;
  error: string;
  errorPct: number;
}) {
  const absPct = Math.abs(errorPct);
  const pctColor = absPct <= 5 ? "text-green-600" : absPct <= 15 ? "text-yellow-600" : "text-red-600";
  return (
    <div className="space-y-1 p-3 bg-gray-50 rounded-lg">
      <p className="text-xs font-semibold text-gray-500 uppercase">{label}</p>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Predictions</span>
        <span className="text-gray-700">{predicted}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-600 font-medium">Actual</span>
        <span className="font-semibold text-gray-900">{actual}</span>
      </div>
      <div className="flex justify-between text-sm pt-1 border-t border-gray-200">
        <span className="text-gray-400 text-xs">Error</span>
        <span className={`text-xs font-medium ${pctColor}`}>
          {error} ({errorPct >= 0 ? "+" : ""}{errorPct.toFixed(1)}%)
        </span>
      </div>
    </div>
  );
}

function AccuracyBadge({ direction, label }: { direction: "over" | "under" | "accurate"; label: string }) {
  const styles = {
    accurate: "bg-green-100 text-green-700",
    over: "bg-orange-100 text-orange-700",
    under: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[direction]}`}>{label}</span>
  );
}
