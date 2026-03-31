export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { comparePredictedVsActual } from "@/lib/prediction-utils";
import type { DailyRecord, SalesPrediction } from "@/types";

async function getPerformanceData() {
  try {
    const predictions = (await prisma.salesPrediction.findMany({
      orderBy: { targetDate: "desc" },
      take: 30,
    })) as SalesPrediction[];

    const results = await Promise.all(
      predictions.map(async (pred) => {
        const start = new Date(pred.targetDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(pred.targetDate);
        end.setHours(23, 59, 59, 999);

        const actual = (await prisma.dailyRecord.findFirst({
          where: { date: { gte: start, lte: end } },
        })) as DailyRecord | null;

        const comparison = actual ? comparePredictedVsActual(pred, actual) : null;
        return { prediction: pred, actual, comparison };
      })
    );

    const comparable = results.filter((r) => r.comparison !== null);

    const avgSalesError =
      comparable.length > 0
        ? comparable.reduce((s, r) => s + r.comparison!.salesErrorAbs, 0) / comparable.length
        : 0;

    const avgBagelsError =
      comparable.length > 0
        ? comparable.reduce((s, r) => s + r.comparison!.bagelsErrorAbs, 0) / comparable.length
        : 0;

    const avgSalesErrorPct =
      comparable.length > 0
        ? comparable.reduce((s, r) => s + Math.abs(r.comparison!.salesErrorPct), 0) / comparable.length
        : 0;

    const avgBagelsErrorPct =
      comparable.length > 0
        ? comparable.reduce((s, r) => s + Math.abs(r.comparison!.bagelsErrorPct), 0) / comparable.length
        : 0;

    // Accuracy is determined by bagel count error (the operationally critical metric)
    const accurateCount = comparable.filter((r) => r.comparison!.direction === "accurate").length;

    return {
      results,
      stats: {
        total: predictions.length,
        comparableCount: comparable.length,
        avgSalesError: Math.round(avgSalesError * 100) / 100,
        avgBagelsError: Math.round(avgBagelsError * 10) / 10,
        avgSalesErrorPct: Math.round(avgSalesErrorPct * 10) / 10,
        avgBagelsErrorPct: Math.round(avgBagelsErrorPct * 10) / 10,
        accurateCount,
        accuracyRate: comparable.length > 0 ? Math.round((accurateCount / comparable.length) * 100) : 0,
      },
    };
  } catch {
    return {
      results: [],
      stats: {
        total: 0,
        comparableCount: 0,
        avgSalesError: 0,
        avgBagelsError: 0,
        avgSalesErrorPct: 0,
        avgBagelsErrorPct: 0,
        accurateCount: 0,
        accuracyRate: 0,
      },
    };
  }
}

export default async function PredictionPerformancePage() {
  const { results, stats } = await getPerformanceData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Predictions Performance</h1>
          <p className="text-gray-500 mt-1">Compare prediction results with actual performance (last 30 items)</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/predictions"
            className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Predictions List
          </Link>
          <Link
            href="/predictions/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            + New Prediction
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard
          title="🥯 Average Bagel Error Rate"
          value={`${stats.avgBagelsErrorPct.toFixed(1)}%`}
          sub={`Avg. absolute error ${stats.avgBagelsError.toFixed(1)} bagels`}
          color={stats.avgBagelsErrorPct <= 10 ? "green" : stats.avgBagelsErrorPct <= 20 ? "yellow" : "red"}
          primary
        />
        <StatCard
          title="🥯 Accurate Predictions"
          value={`${stats.accurateCount}`}
          sub={`Bagel error ≤5% · ${stats.accuracyRate}%`}
          color={stats.accuracyRate >= 60 ? "green" : stats.accuracyRate >= 40 ? "yellow" : "red"}
          primary
        />
        <StatCard
          title="Total Predictions"
          value={`${stats.total}`}
          sub="Based on last 30 items"
          color="blue"
        />
        <StatCard
          title="Comparison Available"
          value={`${stats.comparableCount}`}
          sub="Has Actual Data"
          color="gray"
        />
        <StatCard
          title="Average Sales Error Rate"
          value={`${stats.avgSalesErrorPct.toFixed(1)}%`}
          sub={`Average absolute error ${formatCurrency(stats.avgSalesError)}`}
          color={stats.avgSalesErrorPct <= 10 ? "green" : stats.avgSalesErrorPct <= 20 ? "yellow" : "red"}
        />
        <StatCard
          title="Average Sales Error"
          value={formatCurrency(stats.avgSalesError)}
          sub="Average Absolute Error"
          color="gray"
        />
      </div>

      {/* Guidance */}
      {stats.comparableCount === 0 && stats.total > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <strong>💡 Note:</strong> Predictions exist but no actual data to compare yet. Enter Actual Sales for the prediction date to compare performance.
        </div>
      )}
      {stats.total === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-4xl mb-3">🔮</p>
          <p className="text-gray-500 mb-4">No predictions created yet.</p>
          <Link
            href="/predictions/new"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create First Prediction
          </Link>
        </div>
      )}

      {/* Comparison Table */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Predictions vs Actual Comparison List</h2>
            <p className="text-xs text-gray-400">Latest first</p>
          </div>

          {/* Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-amber-600">🥯 Predicted Bagels</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-amber-600">🥯 Actual Bagels</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-amber-600">Bagel Error</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Predicted Sales</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Actual Sales</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Sales Error</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Accuracy</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map(({ prediction, actual, comparison }) => (
                  <tr key={prediction.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      <Link href={`/predictions/${prediction.id}`} className="hover:text-blue-700">
                        {formatDate(prediction.targetDate)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-amber-700 text-right font-medium">
                      {prediction.predictedBagelsSold}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                      {comparison ? `${comparison.actualBagelsSold}` : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {comparison ? (
                        <ErrorBadge value={comparison.bagelsError} pct={comparison.bagelsErrorPct} />
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">
                      {formatCurrency(prediction.predictedSales)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                      {actual ? formatCurrency(comparison!.actualSales) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {comparison ? (
                        <ErrorBadge value={comparison.salesError} pct={comparison.salesErrorPct} isCurrency />
                      ) : (
                        <span className="text-xs text-gray-300">No Data</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {comparison ? (
                        <AccuracyBadge direction={comparison.direction} label={comparison.label} />
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/predictions/${prediction.id}`} className="text-xs text-blue-600 hover:underline">
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="lg:hidden divide-y divide-gray-100">
            {results.map(({ prediction, actual, comparison }) => (
              <div key={prediction.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <Link href={`/predictions/${prediction.id}`} className="font-medium text-gray-900 hover:text-blue-700">
                    {formatDate(prediction.targetDate)}
                  </Link>
                  {comparison ? (
                    <AccuracyBadge direction={comparison.direction} label={comparison.label} />
                  ) : (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">No Data</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-amber-50 rounded p-2">
                    <p className="text-xs text-amber-600 font-medium">🥯 Predicted Bagels</p>
                    <p className="font-semibold text-amber-800">{prediction.predictedBagelsSold}</p>
                  </div>
                  {comparison && (
                    <div className="bg-amber-50 rounded p-2">
                      <p className="text-xs text-amber-600 font-medium">🥯 Actual Bagels</p>
                      <p className="font-semibold text-amber-800">{comparison.actualBagelsSold}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">Predicted Sales</p>
                    <p className="text-gray-600">{formatCurrency(prediction.predictedSales)}</p>
                  </div>
                  {actual && (
                    <div>
                      <p className="text-xs text-gray-500">Actual Sales</p>
                      <p className="font-medium text-gray-900">{formatCurrency(comparison!.actualSales)}</p>
                    </div>
                  )}
                  {comparison && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Bagel Error</p>
                      <ErrorBadge value={comparison.bagelsError} pct={comparison.bagelsErrorPct} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interpretation Guide */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
        <p className="font-semibold mb-2">🥯 Accuracy Baseline Guide (based on bagel count)</p>
        <p className="text-xs text-amber-700 mb-2">Accuracy is measured by how closely the predicted bagel count matches actual bagels sold — this is the key metric for production planning.</p>
        <ul className="space-y-1 text-xs text-amber-800">
          <li>• <strong>Accurate</strong>: Bagel count error within ±5%</li>
          <li>• <strong>Slightly high/low predictions</strong>: Bagel count error ±5~10%</li>
          <li>• <strong>High/low predictions</strong>: Bagel count error ±10~20%</li>
          <li>• <strong>Significantly high/low predictions</strong>: Bagel count error &gt; 20%</li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  color = "gray",
  primary = false,
}: {
  title: string;
  value: string;
  sub: string;
  color?: "blue" | "green" | "yellow" | "red" | "gray";
  primary?: boolean;
}) {
  const colorMap = {
    blue: "border-blue-200 bg-blue-50",
    green: "border-green-200 bg-green-50",
    yellow: "border-yellow-200 bg-yellow-50",
    red: "border-red-200 bg-red-50",
    gray: "border-gray-200 bg-white",
  };
  const textMap = {
    blue: "text-blue-700",
    green: "text-green-700",
    yellow: "text-yellow-700",
    red: "text-red-700",
    gray: "text-gray-900",
  };
  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]} ${primary ? "ring-2 ring-amber-300" : ""}`}>
      <p className="text-xs text-gray-500">{title}</p>
      <p className={`text-xl font-bold mt-1 ${textMap[color]}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function ErrorBadge({
  value,
  pct,
  isCurrency = false,
}: {
  value: number;
  pct: number;
  isCurrency?: boolean;
}) {
  const isPositive = value >= 0;
  const display = isCurrency
    ? `${isPositive ? "+" : ""}${new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(value)}`
    : `${isPositive ? "+" : ""}${value.toFixed(1)}`;
  return (
    <span className={`text-xs font-medium ${isPositive ? "text-blue-600" : "text-orange-600"}`}>
      {display}
      <span className="text-gray-400 ml-1">({isPositive ? "+" : ""}{pct.toFixed(1)}%)</span>
    </span>
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
