export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { SalesPrediction } from "@/types";

async function getPredictions(): Promise<SalesPrediction[]> {
  try {
    return (await prisma.salesPrediction.findMany({
      orderBy: { targetDate: "desc" },
    })) as SalesPrediction[];
  } catch {
    return [];
  }
}

const METHOD_LABELS: Record<string, string> = {
  rule_based_v1: "Rule-based v1",
  rule_based_v2: "Rule-based v2",
  weighted_v1: "Weights-based v1",
  manual: "Manual Enter",
};

export default async function PredictionsPage() {
  const predictions = await getPredictions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Predictions List</h1>
          <p className="text-gray-500 mt-1">Bagel count & production predictions ({predictions.length} items)</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/predictions/performance"
            className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            📊 View Performance
          </Link>
          <Link
            href="/predictions/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            + Create New Prediction
          </Link>
        </div>
      </div>

      {predictions.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">🔮</p>
          <p className="text-gray-500 mb-4">No predictions created yet.</p>
          <Link
            href="/predictions/new"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Create First Prediction
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile */}
          <div className="lg:hidden space-y-3">
            {predictions.map((p) => (
              <Link
                key={p.id}
                href={`/predictions/${p.id}`}
                className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-amber-300 hover:bg-amber-50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <span className="font-medium text-gray-900">{formatDate(p.targetDate)}</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    {METHOD_LABELS[p.method] ?? p.method}
                  </span>
                </div>
                <div className="mt-1 text-sm font-semibold text-amber-700">
                  🥯 {p.predictedBagelsSold} bagels · Production: {p.recommendedBagelsToBake}
                </div>
                <div className="mt-1 text-xs text-gray-500 flex gap-3">
                  <span>Sales: {formatCurrency(p.predictedSales)}</span>
                  {p.confidenceScore != null && (
                    <span>Confidence {p.confidenceScore}%</span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden lg:block bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Predictions Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-amber-600 uppercase">🥯 Estimated Sold Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-amber-600 uppercase">🥯 Recommended Production</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Predicted Sales</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {predictions.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      <Link href={`/predictions/${p.id}`} className="hover:text-blue-700">
                        {formatDate(p.targetDate)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-amber-700 text-right">{p.predictedBagelsSold}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-amber-700 text-right">{p.recommendedBagelsToBake}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatCurrency(p.predictedSales)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        {METHOD_LABELS[p.method] ?? p.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
