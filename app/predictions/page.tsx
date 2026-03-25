import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";

async function getPredictions() {
  try {
    return await prisma.salesPrediction.findMany({
      orderBy: { targetDate: "desc" },
    });
  } catch {
    return [];
  }
}

const METHOD_LABELS: Record<string, string> = {
  rule_based_v1: "규칙 기반 v1",
  weighted_v1: "가중치 기반 v1",
  manual: "수동 입력",
};

export default async function PredictionsPage() {
  const predictions = await getPredictions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">예측 목록</h1>
          <p className="text-gray-500 mt-1">매출 예측 결과 ({predictions.length}건)</p>
        </div>
        <Link
          href="/predictions/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          + 새 예측 만들기
        </Link>
      </div>

      {predictions.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">🔮</p>
          <p className="text-gray-500 mb-4">아직 생성된 예측이 없습니다.</p>
          <Link
            href="/predictions/new"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            첫 번째 예측 만들기
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
                className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <span className="font-medium text-gray-900">{formatDate(p.targetDate)}</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    {METHOD_LABELS[p.method] ?? p.method}
                  </span>
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  예상 매출: <span className="font-medium">{formatCurrency(p.predictedSales)}</span>
                </div>
                <div className="mt-1 text-xs text-gray-500 flex gap-3">
                  <span>베이글 {p.predictedBagelsSold}개</span>
                  <span>생산 추천 {p.recommendedBagelsToBake}개</span>
                  {p.confidenceScore != null && (
                    <span>신뢰도 {p.confidenceScore}%</span>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">예측 날짜</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">예상 매출</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">예상 판매량</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">추천 생산량</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">방식</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">생성일</th>
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
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(p.predictedSales)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{p.predictedBagelsSold}개</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{p.recommendedBagelsToBake}개</td>
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
