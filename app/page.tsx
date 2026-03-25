export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { getTotalSales, getSoldBagels, formatCurrency, formatDate } from "@/lib/utils";
import { getWasteRate, getChannelRatios } from "@/lib/analytics";
import type { DailyRecord } from "@/types";

async function getDashboardData() {
  try {
    const recentRecords: DailyRecord[] = await prisma.dailyRecord.findMany({
      orderBy: { date: "desc" },
      take: 7,
    });

    const latestRecord = recentRecords[0] ?? null;

    const totalSalesSum = recentRecords.reduce(
      (sum, r) => sum + getTotalSales(r),
      0
    );
    const avgDailySales =
      recentRecords.length > 0 ? totalSalesSum / recentRecords.length : 0;

    const totalBagelsSold = recentRecords.reduce(
      (sum, r) => sum + getSoldBagels(r),
      0
    );

    const avgWasteRate =
      recentRecords.length > 0
        ? recentRecords.reduce((sum, r) => sum + getWasteRate(r), 0) / recentRecords.length
        : 0;

    const latestChannelRatios = latestRecord ? getChannelRatios(latestRecord) : null;

    const latestPrediction = await prisma.salesPrediction.findFirst({
      orderBy: { targetDate: "desc" },
    });

    const latestImportJob = await prisma.importJob.findFirst({
      orderBy: { createdAt: "desc" },
    });

    return { recentRecords, latestRecord, avgDailySales, totalBagelsSold, avgWasteRate, latestChannelRatios, latestPrediction, latestImportJob };
  } catch {
    return {
      recentRecords: [],
      latestRecord: null,
      avgDailySales: 0,
      totalBagelsSold: 0,
      avgWasteRate: 0,
      latestChannelRatios: null,
      latestPrediction: null,
      latestImportJob: null,
    };
  }
}

export default async function DashboardPage() {
  const { recentRecords, latestRecord, avgDailySales, totalBagelsSold, avgWasteRate, latestChannelRatios, latestPrediction, latestImportJob } =
    await getDashboardData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-gray-500 mt-1">베이글스 비욘드 매출 현황</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="최근 7일 총매출"
          value={formatCurrency(
            recentRecords.reduce((sum, r) => sum + getTotalSales(r), 0)
          )}
          sub={`${recentRecords.length}일 기록`}
        />
        <StatCard
          title="평균 일매출"
          value={formatCurrency(avgDailySales)}
          sub="최근 기록 기준"
        />
        <StatCard
          title="총 판매 베이글"
          value={`${totalBagelsSold}개`}
          sub="최근 7일"
        />
        <StatCard
          title="최근 7일 평균 폐기율"
          value={`${(avgWasteRate * 100).toFixed(1)}%`}
          sub="베이글 폐기율"
        />
        <StatCard
          title="최근 기록일"
          value={latestRecord ? formatDate(latestRecord.date) : "-"}
          sub={
            latestRecord
              ? formatCurrency(getTotalSales(latestRecord))
              : "기록 없음"
          }
        />
        {latestChannelRatios && (
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-2">최근 기록 채널 비중</p>
            <div className="flex flex-wrap gap-1">
              {latestChannelRatios.store > 0 && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                  매장 {latestChannelRatios.store.toFixed(1)}%
                </span>
              )}
              {latestChannelRatios.uber > 0 && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                  우버 {latestChannelRatios.uber.toFixed(1)}%
                </span>
              )}
              {latestChannelRatios.doordash > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                  도어대쉬 {latestChannelRatios.doordash.toFixed(1)}%
                </span>
              )}
              {latestChannelRatios.other > 0 && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                  기타 {latestChannelRatios.other.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">빠른 이동</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction href="/sales/new" label="새 매출 입력" icon="➕" />
          <QuickAction href="/sales" label="매출 목록" icon="📋" />
          <QuickAction href="/calendar" label="달력 보기" icon="📅" />
          <QuickAction href="/settings" label="설정" icon="⚙️" />
          <QuickAction href="/predictions/new" label="새 예측 만들기" icon="🔮" />
          <QuickAction href="/imports/new" label="CSV 가져오기" icon="📂" />
          <QuickAction href="/imports" label="가져오기 목록" icon="📋" />
        </div>
      </div>

      {/* Prediction Section */}
      {latestPrediction && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">최근 예측</h2>
          <div className="bg-white rounded-lg border border-blue-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">예측 대상일: {formatDate(latestPrediction.targetDate)}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(latestPrediction.predictedSales)}</p>
                <div className="flex gap-4 mt-2 text-sm text-gray-600">
                  <span>예상 판매 {latestPrediction.predictedBagelsSold}개</span>
                  <span>추천 생산 {latestPrediction.recommendedBagelsToBake}개</span>
                </div>
              </div>
              {latestPrediction.confidenceScore != null && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">신뢰도</p>
                  <p className="text-lg font-bold text-blue-600">{latestPrediction.confidenceScore}%</p>
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <Link
                href={`/predictions/${latestPrediction.id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                상세 보기 →
              </Link>
              <span className="text-gray-300">|</span>
              <Link href="/predictions" className="text-sm text-blue-600 hover:underline">
                전체 예측 목록
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Recent Import Job */}
      {latestImportJob && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">최근 CSV 가져오기</h2>
          <div className="bg-white rounded-lg border border-purple-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{latestImportJob.fileName}</p>
                <p className="text-sm text-gray-500 mt-1">
                  총 {latestImportJob.totalRows}행 · 성공 {latestImportJob.successRows} · 실패 {latestImportJob.failedRows}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                latestImportJob.status === "imported" ? "bg-purple-100 text-purple-700"
                : latestImportJob.status === "ready" ? "bg-green-100 text-green-700"
                : latestImportJob.status === "failed" ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-700"
              }`}>
                {latestImportJob.status === "imported" ? "임포트됨"
                  : latestImportJob.status === "ready" ? "준비완료"
                  : latestImportJob.status === "failed" ? "실패"
                  : latestImportJob.status}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <Link href={`/imports/${latestImportJob.id}`} className="text-sm text-purple-600 hover:underline">
                상세 보기 →
              </Link>
              <span className="text-gray-300">|</span>
              <Link href="/imports" className="text-sm text-purple-600 hover:underline">
                전체 목록
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Recent Records */}
      {recentRecords.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            최근 매출 요약
          </h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">총매출</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">판매 베이글</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">남은 베이글</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentRecords.slice(0, 5).map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <Link href={`/sales/${record.id}`} className="hover:text-amber-700">
                        {formatDate(record.date)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(getTotalSales(record))}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{getSoldBagels(record)}개</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{record.bagelsLeft}개</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

function StatCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function QuickAction({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 rounded-lg hover:bg-amber-50 hover:border-amber-200 transition-colors"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </Link>
  );
}
