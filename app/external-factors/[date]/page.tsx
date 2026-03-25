export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import type { SalesPrediction } from "@/types";
import CollectExternalButton from "@/components/CollectExternalButton";

type Props = { params: Promise<{ date: string }> };

function formatDate(date: Date) {
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
}

export default async function ExternalFactorDetailPage({ params }: Props) {
  const { date: dateParam } = await params;

  const parsedDate = new Date(`${dateParam}T00:00:00.000Z`);
  if (isNaN(parsedDate.getTime())) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">유효하지 않은 날짜입니다: {dateParam}</p>
        <Link href="/external-factors" className="text-amber-600 hover:underline text-sm">← 목록으로</Link>
      </div>
    );
  }

  const factor = await prisma.dailyExternalFactor.findUnique({ where: { date: parsedDate } });

  // Check for linked DailyRecord and Predictions
  const dailyRecord = await prisma.dailyRecord.findUnique({ where: { date: parsedDate } });
  const predictions = await prisma.salesPrediction.findMany({
    where: { targetDate: parsedDate },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/external-factors" className="text-sm text-amber-600 hover:underline">
            ← 외부 데이터 목록
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{formatDate(parsedDate)}</h1>
          <p className="text-gray-500 text-sm mt-0.5">외부 요인 상세</p>
        </div>
        <CollectExternalButton date={dateParam} />
      </div>

      {/* External Factor Data */}
      {factor ? (
        <>
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">날씨</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <InfoItem label="날씨 요약" value={factor.weatherSummary ?? "—"} />
              <InfoItem label="최저 기온" value={factor.minTemp != null ? `${factor.minTemp}°C` : "—"} />
              <InfoItem label="최고 기온" value={factor.maxTemp != null ? `${factor.maxTemp}°C` : "—"} />
              <InfoItem label="강수량" value={factor.rainMm != null ? `${factor.rainMm}mm` : "—"} />
              <InfoItem label="풍속" value={factor.windKph != null ? `${factor.windKph}kph` : "—"} />
              {factor.sourceWeather && <InfoItem label="소스" value={factor.sourceWeather} />}
            </dl>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">공휴일 &amp; 방학</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <InfoItem label="공휴일" value={factor.holidayName ?? "없음"} />
              <InfoItem label="학교 방학" value={factor.schoolHoliday ? "예" : "아니오"} />
              {factor.sourceHoliday && <InfoItem label="공휴일 소스" value={factor.sourceHoliday} />}
            </dl>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">이벤트 &amp; 뉴스</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoItem label="지역 이벤트" value={factor.localEventName ?? "없음"} />
              {factor.sourceEvents && <InfoItem label="이벤트 소스" value={factor.sourceEvents} />}
              {factor.nzNewsSummary && (
                <div className="sm:col-span-2">
                  <InfoItem label="뉴질랜드 뉴스" value={factor.nzNewsSummary} />
                </div>
              )}
              {factor.worldNewsSummary && (
                <div className="sm:col-span-2">
                  <InfoItem label="국제 뉴스" value={factor.worldNewsSummary} />
                </div>
              )}
              {factor.sourceNews && <InfoItem label="뉴스 소스" value={factor.sourceNews} />}
            </dl>
          </div>

          {/* Meta info */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-xs text-gray-500 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <InfoItem label="수집 시각" value={factor.collectedAt ? new Date(factor.collectedAt).toLocaleString("ko-KR") : "—"} />
            <InfoItem label="마지막 갱신" value={factor.lastRefreshedAt ? new Date(factor.lastRefreshedAt).toLocaleString("ko-KR") : "—"} />
            <InfoItem label="생성일" value={new Date(factor.createdAt).toLocaleString("ko-KR")} />
            <InfoItem label="ID" value={factor.id.slice(0, 8) + "…"} />
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-4xl">📭</p>
          <p className="text-gray-600 mt-3 font-medium">이 날짜의 외부 데이터가 없습니다.</p>
          <p className="text-gray-400 text-sm mt-1">위 &apos;외부 데이터 수집&apos; 버튼을 눌러 수집을 시작하세요.</p>
        </div>
      )}

      {/* Linked records */}
      {(dailyRecord || predictions.length > 0) && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
          <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">연결된 데이터</h2>
          <div className="space-y-2">
            {dailyRecord && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">📊 매출 기록</span>
                <Link href={`/sales/${dailyRecord.id}`} className="text-amber-600 hover:underline">
                  {formatDate(new Date(dailyRecord.date))} 보기 →
                </Link>
              </div>
            )}
            {predictions.map((p: SalesPrediction) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">🔮 예측</span>
                <Link href={`/predictions/${p.id}`} className="text-blue-600 hover:underline">
                  {new Date(p.createdAt).toLocaleString("ko-KR")} 보기 →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-900 break-words">{value}</dd>
    </div>
  );
}
