import Link from "next/link";
import { prisma } from "@/lib/db";
import { getTotalSales, getSoldBagels, getChannelBreakdown, formatCurrency, formatDate } from "@/lib/utils";

async function getSalesData() {
  try {
    return await prisma.dailyRecord.findMany({
      orderBy: { date: "desc" },
      include: { externalFactor: true },
    });
  } catch {
    return [];
  }
}

export default async function SalesPage() {
  const records = await getSalesData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">매출 목록</h1>
          <p className="text-gray-500 mt-1">일별 매출 기록</p>
        </div>
        <Link
          href="/sales/new"
          className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors text-sm font-medium"
        >
          + 새 매출 입력
        </Link>
      </div>

      {records.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500 mb-4">아직 입력된 매출 데이터가 없습니다.</p>
          <Link
            href="/sales/new"
            className="inline-flex items-center px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors"
          >
            첫 번째 매출 입력하기
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {formatDate(record.date)}
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
      )}
    </div>
  );
}
