import Link from "next/link";
import { prisma } from "@/lib/db";
import { getTotalSales, getSoldBagels, getChannelBreakdown, formatCurrency, formatDate } from "@/lib/utils";
import FilterBar from "@/components/FilterBar";
import { Suspense } from "react";
import type { DailyRecord } from "@/types";

type SearchParams = { startDate?: string; endDate?: string; keyword?: string };

async function getSalesData(searchParams: SearchParams): Promise<DailyRecord[]> {
  try {
    const { startDate, endDate, keyword } = searchParams;
    return await prisma.dailyRecord.findMany({
      orderBy: { date: "desc" },
      include: { externalFactor: true },
      where: {
        date: {
          gte: startDate ? new Date(startDate) : undefined,
          lte: endDate ? new Date(endDate) : undefined,
        },
        OR: keyword
          ? [
              { notes: { contains: keyword, mode: "insensitive" } },
              { externalFactor: { localEventName: { contains: keyword, mode: "insensitive" } } },
              { externalFactor: { holidayName: { contains: keyword, mode: "insensitive" } } },
            ]
          : undefined,
      },
    });
  } catch {
    return [];
  }
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const records = await getSalesData(sp);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">매출 목록</h1>
          <p className="text-gray-500 mt-1">일별 매출 기록 ({records.length}건)</p>
        </div>
        <Link
          href="/sales/new"
          className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors text-sm font-medium"
        >
          + 새 매출 입력
        </Link>
      </div>

      <Suspense>
        <FilterBar />
      </Suspense>

      {records.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500 mb-4">검색 결과가 없습니다.</p>
          <Link
            href="/sales/new"
            className="inline-flex items-center px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors"
          >
            첫 번째 매출 입력하기
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {records.map((record) => {
              const total = getTotalSales(record);
              const sold = getSoldBagels(record);
              return (
                <Link
                  key={record.id}
                  href={`/sales/${record.id}`}
                  className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-amber-300 hover:bg-amber-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-gray-900">{formatDate(record.date)}</span>
                    <span className="font-semibold text-amber-700">{formatCurrency(total)}</span>
                  </div>
                  <div className="mt-1 text-sm text-gray-500 flex gap-3">
                    <span>판매 {sold}개</span>
                    <span>잔여 {record.bagelsLeft}개</span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">총매출</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">판매</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">잔여</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">채널별</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {records.map((record) => {
                  const breakdown = getChannelBreakdown(record);
                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => {}}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        <Link href={`/sales/${record.id}`} className="hover:text-amber-700">
                          {formatDate(record.date)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                        {formatCurrency(getTotalSales(record))}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {getSoldBagels(record)}개
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {record.bagelsLeft}개
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        <div className="flex flex-wrap gap-1">
                          {breakdown.store.amount > 0 && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                              매장 {formatCurrency(breakdown.store.amount)}
                            </span>
                          )}
                          {breakdown.uber.amount > 0 && (
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                              우버 {formatCurrency(breakdown.uber.amount)}
                            </span>
                          )}
                          {breakdown.doordash.amount > 0 && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                              도어대쉬 {formatCurrency(breakdown.doordash.amount)}
                            </span>
                          )}
                          {breakdown.other.amount > 0 && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                              기타 {formatCurrency(breakdown.other.amount)}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
