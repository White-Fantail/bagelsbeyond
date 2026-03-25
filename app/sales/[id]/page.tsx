import Link from "next/link";
import { prisma } from "@/lib/db";
import { getTotalSales, getSoldBagels, getChannelBreakdown, formatCurrency, formatDate } from "@/lib/utils";
import { getSellThroughRate, getWasteRate } from "@/lib/analytics";
import DeleteRecordButton from "@/components/DeleteRecordButton";
import RefreshExternalFactorButton from "@/components/RefreshExternalFactorButton";

type Props = { params: Promise<{ id: string }> };

export default async function SalesDetailPage({ params }: Props) {
  const { id } = await params;

  const record = await prisma.dailyRecord.findUnique({
    where: { id },
    include: { externalFactor: true },
  });

  if (!record) {
    return (
      <div className="space-y-4">
        <p className="text-gray-600">기록을 찾을 수 없습니다.</p>
        <Link href="/sales" className="text-amber-600 hover:underline text-sm">
          ← 매출 목록으로
        </Link>
      </div>
    );
  }

  const total = getTotalSales(record);
  const sold = getSoldBagels(record);
  const breakdown = getChannelBreakdown(record);
  const sellThrough = getSellThroughRate(record);
  const wasteRate = getWasteRate(record);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/sales" className="text-sm text-amber-600 hover:underline">
            ← 매출 목록
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            {formatDate(record.date)}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/sales/${id}/edit`}
            className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors text-sm font-medium"
          >
            수정
          </Link>
          <DeleteRecordButton recordId={id} />
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
        <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">기본 정보</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoItem label="구운 베이글" value={`${record.bagelsBaked}개`} />
          <InfoItem label="남은 베이글" value={`${record.bagelsLeft}개`} />
          <InfoItem label="판매 베이글" value={`${sold}개`} />
          <InfoItem label="총 매출" value={formatCurrency(total)} />
          <InfoItem label="매장 매출" value={formatCurrency(breakdown.store.amount)} />
          <InfoItem label="우버 매출" value={formatCurrency(breakdown.uber.amount)} />
          <InfoItem label="도어대쉬 매출" value={formatCurrency(breakdown.doordash.amount)} />
          <InfoItem label="기타 매출" value={formatCurrency(breakdown.other.amount)} />
          {record.notes && (
            <div className="col-span-2 sm:col-span-3">
              <InfoItem label="메모" value={record.notes} />
            </div>
          )}
        </dl>
      </div>

      {/* External Factors */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <h2 className="text-base font-semibold text-gray-900">외부 요인</h2>
          <RefreshExternalFactorButton recordId={id} />
        </div>

        {record.externalFactor ? (
          <>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {record.externalFactor.weatherSummary && (
                <InfoItem label="날씨" value={record.externalFactor.weatherSummary} />
              )}
              {record.externalFactor.minTemp != null && (
                <InfoItem label="최저 기온" value={`${record.externalFactor.minTemp}°C`} />
              )}
              {record.externalFactor.maxTemp != null && (
                <InfoItem label="최고 기온" value={`${record.externalFactor.maxTemp}°C`} />
              )}
              {record.externalFactor.rainMm != null && (
                <InfoItem label="강수량" value={`${record.externalFactor.rainMm}mm`} />
              )}
              {record.externalFactor.windKph != null && (
                <InfoItem label="바람" value={`${record.externalFactor.windKph}kph`} />
              )}
              {record.externalFactor.holidayName && (
                <InfoItem label="공휴일" value={record.externalFactor.holidayName} />
              )}
              {record.externalFactor.localEventName && (
                <InfoItem label="지역 이벤트" value={record.externalFactor.localEventName} />
              )}
              <InfoItem
                label="학교 방학"
                value={record.externalFactor.schoolHoliday ? "예" : "아니오"}
              />
              {record.externalFactor.nzNewsSummary && (
                <div className="col-span-2 sm:col-span-3">
                  <InfoItem label="뉴질랜드 뉴스" value={record.externalFactor.nzNewsSummary} />
                </div>
              )}
              {record.externalFactor.worldNewsSummary && (
                <div className="col-span-2 sm:col-span-3">
                  <InfoItem label="국제 뉴스" value={record.externalFactor.worldNewsSummary} />
                </div>
              )}
            </dl>
            {/* Source info */}
            <div className="mt-2 pt-2 border-t border-gray-50 text-xs text-gray-400 flex flex-wrap gap-3">
              {record.externalFactor.sourceWeather && (
                <span>날씨: {record.externalFactor.sourceWeather}</span>
              )}
              {record.externalFactor.sourceHoliday && (
                <span>공휴일: {record.externalFactor.sourceHoliday}</span>
              )}
              {record.externalFactor.collectedAt && (
                <span>수집: {new Date(record.externalFactor.collectedAt).toLocaleString("ko-KR")}</span>
              )}
              {record.externalFactor.lastRefreshedAt && (
                <span>갱신: {new Date(record.externalFactor.lastRefreshedAt).toLocaleString("ko-KR")}</span>
              )}
              <Link
                href={`/external-factors/${record.date.toISOString().split("T")[0]}`}
                className="text-amber-500 hover:underline"
              >
                외부 데이터 상세 →
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center py-6 text-gray-400 text-sm">
            <p>이 날짜의 외부 데이터가 없습니다.</p>
            <p className="mt-1">위 &apos;외부 데이터 수집&apos; 버튼을 눌러 데이터를 가져올 수 있습니다.</p>
          </div>
        )}
      </div>

      {/* Derived Metrics */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
        <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">파생 지표</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoItem label="판매율" value={`${(sellThrough * 100).toFixed(1)}%`} />
          <InfoItem label="폐기율" value={`${(wasteRate * 100).toFixed(1)}%`} />
          <InfoItem label="폐기 베이글" value={`${record.bagelsLeft}개`} />
          {total > 0 && (
            <>
              <InfoItem label="매장 비중" value={`${breakdown.store.percent.toFixed(1)}%`} />
              <InfoItem label="우버 비중" value={`${breakdown.uber.percent.toFixed(1)}%`} />
              <InfoItem label="도어대쉬 비중" value={`${breakdown.doordash.percent.toFixed(1)}%`} />
              <InfoItem label="기타 비중" value={`${breakdown.other.percent.toFixed(1)}%`} />
            </>
          )}
        </dl>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-900">{value}</dd>
    </div>
  );
}
