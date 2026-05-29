export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import type { SalesPrediction } from "@/types";
import CollectExternalButton from "@/components/CollectExternalButton";

type Props = { params: Promise<{ date: string }> };

function formatDate(date: Date) {
  return date.toLocaleDateString("en-NZ", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
}

export default async function ExternalFactorDetailPage({ params }: Props) {
  const { date: dateParam } = await params;

  const parsedDate = new Date(`${dateParam}T00:00:00.000Z`);
  if (isNaN(parsedDate.getTime())) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">Invalid date: {dateParam}</p>
        <Link href="/external-factors" className="text-amber-600 hover:underline text-sm">← Back to List</Link>
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
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/external-factors" className="text-sm text-amber-600 hover:underline">
            ← External Data List
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{formatDate(parsedDate)}</h1>
          <p className="text-gray-500 text-sm mt-0.5">External Factors Details</p>
        </div>
        <CollectExternalButton date={dateParam} />
      </div>

      {/* External Factor Data */}
      {factor ? (
        <>
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">Weather</h2>
            {factor.sourceWeather === "open-meteo:failed" && (
              <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-sm text-red-700 flex items-center gap-2">
                <span>⚠️</span>
                <span>Weather Collection failed — click the collect button again to retry.</span>
              </div>
            )}
            {!factor.sourceWeather && !factor.weatherSummary && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2 text-sm text-yellow-700 flex items-center gap-2">
                <span>ℹ️</span>
                <span>No weather data available. click the collect button.</span>
              </div>
            )}
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <InfoItem label="Weather Summary" value={factor.weatherSummary ?? "—"} />
              <InfoItem label="Min Temp" value={factor.minTemp != null ? `${factor.minTemp}°C` : "—"} />
              <InfoItem label="Max Temp" value={factor.maxTemp != null ? `${factor.maxTemp}°C` : "—"} />
              <InfoItem label="Rainfall" value={factor.rainMm != null ? `${factor.rainMm}mm` : "—"} />
              <InfoItem label="Wind Speed" value={factor.windKph != null ? `${factor.windKph}kph` : "—"} />
              {factor.sourceWeather && factor.sourceWeather !== "open-meteo:failed" && (
                <InfoItem label="Source" value={factor.sourceWeather} />
              )}
            </dl>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">Holiday &amp; School Holiday</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <InfoItem label="Holiday" value={factor.holidayName ?? "None"} />
              <InfoItem label="School Holiday" value={factor.schoolHoliday ? "Yes" : "No"} />
              {factor.sourceHoliday && <InfoItem label="Holiday Source" value={factor.sourceHoliday} />}
            </dl>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">Event &amp; News</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoItem label="Local Event" value={factor.localEventName ?? "None"} />
              {factor.sourceEvents && <InfoItem label="Event Source" value={factor.sourceEvents} />}
              {factor.nzNewsSummary && (
                <div className="sm:col-span-2">
                  <InfoItem label="NZ News" value={factor.nzNewsSummary} />
                </div>
              )}
              {factor.worldNewsSummary && (
                <div className="sm:col-span-2">
                  <InfoItem label="World News" value={factor.worldNewsSummary} />
                </div>
              )}
              {factor.sourceNews && <InfoItem label="News Source" value={factor.sourceNews} />}
            </dl>
          </div>

          {/* Meta info */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-xs text-gray-500 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <InfoItem label="Collected At" value={factor.collectedAt ? new Date(factor.collectedAt).toLocaleString("en-NZ") : "—"} />
            <InfoItem label="Last Refreshed" value={factor.lastRefreshedAt ? new Date(factor.lastRefreshedAt).toLocaleString("en-NZ") : "—"} />
            <InfoItem label="Created Date" value={new Date(factor.createdAt).toLocaleString("en-NZ")} />
            <InfoItem label="ID" value={factor.id.slice(0, 8) + "…"} />
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-4xl">📭</p>
          <p className="text-gray-600 mt-3 font-medium">No external data for this date.</p>
          <p className="text-gray-400 text-sm mt-1">Click the &apos;Collect External Data&apos; button above to start collection.</p>
        </div>
      )}

      {/* Linked records */}
      {(dailyRecord || predictions.length > 0) && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
          <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">Linked Data</h2>
          <div className="space-y-2">
            {dailyRecord && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">📊 Sales Records</span>
                <Link href={`/sales/${dailyRecord.id}`} className="text-amber-600 hover:underline">
                  {formatDate(new Date(dailyRecord.date))} View →
                </Link>
              </div>
            )}
            {predictions.map((p: SalesPrediction) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">🔮 Predictions</span>
                <Link href={`/predictions/${p.id}`} className="text-blue-600 hover:underline">
                  {new Date(p.createdAt).toLocaleString("en-NZ")} View →
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
