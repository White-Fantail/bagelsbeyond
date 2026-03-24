import Link from "next/link";
import { prisma } from "@/lib/db";
import { getTotalSales, getSoldBagels, formatCurrency, formatDate } from "@/lib/utils";

async function getDashboardData() {
  try {
    const recentRecords = await prisma.dailyRecord.findMany({
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

    return { recentRecords, latestRecord, avgDailySales, totalBagelsSold };
  } catch {
    return {
      recentRecords: [],
      latestRecord: null,
      avgDailySales: 0,
      totalBagelsSold: 0,
    };
  }
}

export default async function DashboardPage() {
  const { recentRecords, latestRecord, avgDailySales, totalBagelsSold } =
    await getDashboardData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-gray-500 mt-1">베이글스 비욘드 매출 현황</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          title="최근 기록일"
          value={latestRecord ? formatDate(latestRecord.date) : "-"}
          sub={
            latestRecord
              ? formatCurrency(getTotalSales(latestRecord))
              : "기록 없음"
          }
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">빠른 이동</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction href="/sales/new" label="새 매출 입력" icon="➕" />
          <QuickAction href="/sales" label="매출 목록" icon="📋" />
          <QuickAction href="/calendar" label="달력 보기" icon="📅" />
          <QuickAction href="/settings" label="설정" icon="⚙️" />
        </div>
      </div>

      {/* Recent Records */}
      {recentRecords.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            최근 7일 매출 요약
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
                {recentRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{formatDate(record.date)}</td>
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
