export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { getTotalSales, getSoldBagels, formatCurrency, formatDate } from "@/lib/utils";
import { getWasteRate } from "@/lib/analytics";
import { comparePredictedVsActual } from "@/lib/prediction-utils";
import type { DailyRecord, SalesPrediction } from "@/types";

async function getDashboardData() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Recent 7 days
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const recentRecords: DailyRecord[] = await prisma.dailyRecord.findMany({
      where: { date: { gte: sevenDaysAgo, lt: today } },
      orderBy: { date: "desc" },
      take: 7,
    });

    const totalSalesSum = recentRecords.reduce((sum, r) => sum + getTotalSales(r), 0);
    const avgDailySales = recentRecords.length > 0 ? totalSalesSum / recentRecords.length : 0;
    const avgBagelsSold =
      recentRecords.length > 0
        ? recentRecords.reduce((sum, r) => sum + getSoldBagels(r), 0) / recentRecords.length
        : 0;
    const avgWasteRate =
      recentRecords.length > 0
        ? recentRecords.reduce((sum, r) => sum + getWasteRate(r), 0) / recentRecords.length
        : 0;

    // Tomorrow's prediction
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);
    const tomorrowPrediction = (await prisma.salesPrediction.findFirst({
      where: { targetDate: { gte: tomorrow, lte: tomorrowEnd } },
      orderBy: { createdAt: "desc" },
    })) as SalesPrediction | null;

    // Recent predictions for accuracy
    const recentPredictions = (await prisma.salesPrediction.findMany({
      orderBy: { targetDate: "desc" },
      take: 10,
      where: { targetDate: { lt: today } },
    })) as SalesPrediction[];

    // Accuracy summary
    let accurateCount = 0;
    let comparableCount = 0;
    for (const pred of recentPredictions) {
      const start = new Date(pred.targetDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(pred.targetDate);
      end.setHours(23, 59, 59, 999);
      const actual = await prisma.dailyRecord.findFirst({ where: { date: { gte: start, lte: end } } });
      if (actual) {
        comparableCount++;
        const cmp = comparePredictedVsActual(pred, actual as DailyRecord);
        if (cmp.direction === "accurate") accurateCount++;
      }
    }

    const latestImportJob = await prisma.importJob.findFirst({
      orderBy: { createdAt: "desc" },
    });

    const latestExternalFactor = await prisma.dailyExternalFactor.findFirst({
      orderBy: { id: "desc" },
      include: { dailyRecord: { select: { date: true } } },
    });

    return {
      recentRecords,
      avgDailySales,
      avgBagelsSold,
      avgWasteRate,
      totalSalesSum,
      tomorrowPrediction,
      accurateCount,
      comparableCount,
      latestImportJob,
      latestExternalFactor,
    };
  } catch {
    return {
      recentRecords: [],
      avgDailySales: 0,
      avgBagelsSold: 0,
      avgWasteRate: 0,
      totalSalesSum: 0,
      tomorrowPrediction: null,
      accurateCount: 0,
      comparableCount: 0,
      latestImportJob: null,
      latestExternalFactor: null,
    };
  }
}

export default async function DashboardPage() {
  const {
    recentRecords,
    avgDailySales,
    avgBagelsSold,
    avgWasteRate,
    totalSalesSum,
    tomorrowPrediction,
    accurateCount,
    comparableCount,
    latestImportJob,
    latestExternalFactor,
  } = await getDashboardData();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  const accuracyRate = comparableCount > 0 ? Math.round((accurateCount / comparableCount) * 100) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">운영 대시보드</h1>
        <p className="text-gray-500 mt-1">Bagels Beyond — 매일 운영 현황을 한눈에</p>
      </div>

      {/* Tomorrow Prediction Card */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">📅 내일 예측</h2>
        {tomorrowPrediction ? (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-blue-600 font-medium">{formatDate(tomorrowPrediction.targetDate)}</p>
                <p className="text-3xl font-bold text-blue-900 mt-1">{formatCurrency(tomorrowPrediction.predictedSales)}</p>
              </div>
              {tomorrowPrediction.confidenceScore != null && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">신뢰도</p>
                  <p className={`text-lg font-bold ${tomorrowPrediction.confidenceScore >= 70 ? "text-green-600" : tomorrowPrediction.confidenceScore >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                    {tomorrowPrediction.confidenceScore}%
                  </p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <PredCard icon="��" label="예상 판매" value={`${tomorrowPrediction.predictedBagelsSold}개`} />
              <PredCard icon="🔥" label="추천 생산" value={`${tomorrowPrediction.recommendedBagelsToBake}개`} highlight />
              <PredCard icon="📦" label="예상 잔여" value={`${tomorrowPrediction.predictedLeftovers}개`} />
              {tomorrowPrediction.projectedSellThroughRate != null && (
                <PredCard icon="📈" label="예상 판매율" value={`${(tomorrowPrediction.projectedSellThroughRate * 100).toFixed(1)}%`} />
              )}
            </div>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Link href={`/predictions/${tomorrowPrediction.id}`} className="text-sm text-blue-700 hover:underline font-medium">
                상세 보기 →
              </Link>
              <span className="text-gray-300">|</span>
              <Link href={`/predictions/new`} className="text-sm text-blue-600 hover:underline">
                재계산
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-6 flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">내일({tomorrowStr}) 예측이 아직 없습니다.</p>
              <p className="text-gray-400 text-xs mt-1">지금 예측을 생성하면 생산량 추천을 받을 수 있습니다.</p>
            </div>
            <Link
              href={`/predictions/new`}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium whitespace-nowrap"
            >
              🔮 내일 예측 만들기
            </Link>
          </div>
        )}
      </div>

      {/* Recent Performance Summary */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">📊 최근 7일 실적</h2>
        {recentRecords.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard title="7일 총매출" value={formatCurrency(totalSalesSum)} sub={`${recentRecords.length}일 기록`} />
            <StatCard title="일평균 매출" value={formatCurrency(avgDailySales)} sub="최근 7일 기준" />
            <StatCard title="일평균 판매량" value={`${Math.round(avgBagelsSold)}개`} sub="베이글" />
            <StatCard
              title="평균 폐기율"
              value={`${(avgWasteRate * 100).toFixed(1)}%`}
              sub="베이글 기준"
              highlight={avgWasteRate > 0.1}
            />
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 text-center">
            <p className="text-gray-400 text-sm">최근 7일 매출 데이터가 없습니다.</p>
            <Link href="/sales/new" className="mt-2 inline-block text-sm text-amber-600 hover:underline">
              매출 입력하기 →
            </Link>
          </div>
        )}
      </div>

      {/* Prediction Accuracy */}
      {comparableCount > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">🎯 최근 예측 정확도</h2>
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">최근 {comparableCount}건 비교 가능</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {accurateCount}건 정확 <span className="text-lg font-normal text-gray-500">/ {comparableCount}건</span>
                </p>
                <p className="text-sm text-gray-500 mt-1">오차율 5% 이내 기준</p>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-bold ${accuracyRate != null && accuracyRate >= 60 ? "text-green-600" : accuracyRate != null && accuracyRate >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                  {accuracyRate ?? "-"}%
                </div>
                <Link href="/predictions/performance" className="text-sm text-blue-600 hover:underline mt-1 block">
                  성과 상세 →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">⚡ 빠른 액션</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <QuickAction href="/sales/new" label="새 매출 입력" icon="➕" color="amber" />
          <QuickAction href="/imports/new" label="CSV 가져오기" icon="📂" color="purple" />
          <QuickAction href="/predictions/new" label="새 예측 만들기" icon="🔮" color="blue" />
          <QuickAction href="/predictions/performance" label="예측 성과" icon="📊" color="green" />
          <QuickAction href="/calendar" label="달력 보기" icon="📅" color="gray" />
        </div>
      </div>

      {/* Recent Records Table */}
      {recentRecords.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">최근 매출 기록</h2>
            <Link href="/sales" className="text-sm text-amber-600 hover:underline">전체 보기 →</Link>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">총매출</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">판매</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">잔여</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">폐기율</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentRecords.slice(0, 5).map((record) => {
                  const wasteRate = getWasteRate(record);
                  return (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <Link href={`/sales/${record.id}`} className="hover:text-amber-700 font-medium">
                          {formatDate(record.date)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(getTotalSales(record))}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{getSoldBagels(record)}개</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{record.bagelsLeft}개</td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${wasteRate > 0.1 ? "text-red-600" : "text-green-600"}`}>
                        {(wasteRate * 100).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import & External Data Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {latestImportJob && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-2">최근 CSV 가져오기</h2>
            <div className="bg-white rounded-lg border border-purple-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{latestImportJob.fileName}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    총 {latestImportJob.totalRows}행 · 성공 {latestImportJob.successRows} · 실패 {latestImportJob.failedRows}
                  </p>
                </div>
                <StatusBadge status={latestImportJob.status} />
              </div>
              <Link href={`/imports/${latestImportJob.id}`} className="text-xs text-purple-600 hover:underline mt-2 block">
                상세 보기 →
              </Link>
            </div>
          </div>
        )}
        {latestExternalFactor && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-2">외부 데이터 수집 현황</h2>
            <div className="bg-white rounded-lg border border-teal-200 p-4">
              <p className="text-sm font-medium text-gray-900">
                최근 수집일: {latestExternalFactor.dailyRecord ? formatDate((latestExternalFactor.dailyRecord as { date: Date }).date) : "-"}
              </p>
              <Link href="/sales" className="text-xs text-teal-600 hover:underline mt-2 block">
                매출 기록 보기 →
              </Link>
            </div>
          </div>
        )}
      </div>

      {recentRecords.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">🥯</p>
          <p className="text-gray-500 mb-4">아직 입력된 매출 데이터가 없습니다.</p>
          <Link
            href="/sales/new"
            className="inline-flex items-center px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors"
          >
            첫 번째 매출 입력하기
          </Link>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  highlight,
}: {
  title: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-5 ${highlight ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${highlight ? "text-red-700" : "text-gray-900"}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function PredCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: string;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg p-3 text-center ${highlight ? "bg-blue-100 border border-blue-300" : "bg-white border border-blue-100"}`}>
      <div className="text-xl mb-1">{icon}</div>
      <p className="text-xs text-blue-600">{label}</p>
      <p className={`text-base font-bold mt-0.5 ${highlight ? "text-blue-900" : "text-blue-700"}`}>{value}</p>
    </div>
  );
}

function QuickAction({
  href,
  label,
  icon,
  color,
}: {
  href: string;
  label: string;
  icon: string;
  color: "amber" | "purple" | "blue" | "green" | "gray";
}) {
  const hover = {
    amber: "hover:bg-amber-50 hover:border-amber-200",
    purple: "hover:bg-purple-50 hover:border-purple-200",
    blue: "hover:bg-blue-50 hover:border-blue-200",
    green: "hover:bg-green-50 hover:border-green-200",
    gray: "hover:bg-gray-50 hover:border-gray-300",
  }[color];
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 rounded-lg transition-colors ${hover}`}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-medium text-gray-700 text-center leading-tight">{label}</span>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    imported: "bg-purple-100 text-purple-700",
    ready: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    pending: "bg-gray-100 text-gray-700",
    validating: "bg-yellow-100 text-yellow-700",
  };
  const label: Record<string, string> = {
    imported: "임포트됨",
    ready: "준비완료",
    failed: "실패",
    pending: "대기중",
    validating: "검증중",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-700"}`}>
      {label[status] ?? status}
    </span>
  );
}
