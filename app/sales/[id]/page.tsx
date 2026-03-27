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
        <p className="text-gray-600">Record not found.</p>
        <Link href="/sales" className="text-amber-600 hover:underline text-sm">
          ← Back to Sales List
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
            ← Sales List
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
            Edit
          </Link>
          <DeleteRecordButton recordId={id} />
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
        <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">Default Info</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoItem label="Bagels Baked" value={`${record.bagelsBaked}`} />
          <InfoItem label="Bagels Left" value={`${record.bagelsLeft}`} />
          <InfoItem label="Sold Bagels" value={`${sold}`} />
          <InfoItem label="Total Sales" value={formatCurrency(total)} />
          <InfoItem label="Store Sales" value={formatCurrency(breakdown.store.amount)} />
          <InfoItem label="Uber Sales" value={formatCurrency(breakdown.uber.amount)} />
          <InfoItem label="DoorDash Sales" value={formatCurrency(breakdown.doordash.amount)} />
          <InfoItem label="Other Sales" value={formatCurrency(breakdown.other.amount)} />
          {record.notes && (
            <div className="col-span-2 sm:col-span-3">
              <InfoItem label="Notes" value={record.notes} />
            </div>
          )}
        </dl>
      </div>

      {/* External Factors */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <h2 className="text-base font-semibold text-gray-900">External Factors</h2>
          <RefreshExternalFactorButton recordId={id} />
        </div>

        {record.externalFactor ? (
          <>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {record.externalFactor.weatherSummary && (
                <InfoItem label="Weather" value={record.externalFactor.weatherSummary} />
              )}
              {record.externalFactor.minTemp != null && (
                <InfoItem label="Min Temp" value={`${record.externalFactor.minTemp}°C`} />
              )}
              {record.externalFactor.maxTemp != null && (
                <InfoItem label="Max Temp" value={`${record.externalFactor.maxTemp}°C`} />
              )}
              {record.externalFactor.rainMm != null && (
                <InfoItem label="Rainfall" value={`${record.externalFactor.rainMm}mm`} />
              )}
              {record.externalFactor.windKph != null && (
                <InfoItem label="Wind" value={`${record.externalFactor.windKph}kph`} />
              )}
              {record.externalFactor.holidayName && (
                <InfoItem label="Holiday" value={record.externalFactor.holidayName} />
              )}
              {record.externalFactor.localEventName && (
                <InfoItem label="Local Event" value={record.externalFactor.localEventName} />
              )}
              <InfoItem
                label="School Holiday"
                value={record.externalFactor.schoolHoliday ? "Yes" : "No"}
              />
              {record.externalFactor.nzNewsSummary && (
                <div className="col-span-2 sm:col-span-3">
                  <InfoItem label="NZ News" value={record.externalFactor.nzNewsSummary} />
                </div>
              )}
              {record.externalFactor.worldNewsSummary && (
                <div className="col-span-2 sm:col-span-3">
                  <InfoItem label="World News" value={record.externalFactor.worldNewsSummary} />
                </div>
              )}
            </dl>
            {/* Source info */}
            <div className="mt-2 pt-2 border-t border-gray-50 text-xs text-gray-400 flex flex-wrap gap-3">
              {record.externalFactor.sourceWeather && (
                <span>Weather: {record.externalFactor.sourceWeather}</span>
              )}
              {record.externalFactor.sourceHoliday && (
                <span>Holiday: {record.externalFactor.sourceHoliday}</span>
              )}
              {record.externalFactor.collectedAt && (
                <span>Collected: {new Date(record.externalFactor.collectedAt).toLocaleString("en-NZ")}</span>
              )}
              {record.externalFactor.lastRefreshedAt && (
                <span>Refreshed: {new Date(record.externalFactor.lastRefreshedAt).toLocaleString("en-NZ")}</span>
              )}
              <Link
                href={`/external-factors/${record.date.toISOString().split("T")[0]}`}
                className="text-amber-500 hover:underline"
              >
                External Data Details →
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center py-6 text-gray-400 text-sm">
            <p>No external data for this date.</p>
            <p className="mt-1">Click the &apos;Collect External Data&apos; button above to fetch data.</p>
          </div>
        )}
      </div>

      {/* Derived Metrics */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
        <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">Derived Metrics</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoItem label="Sell-through Rate" value={`${(sellThrough * 100).toFixed(1)}%`} />
          <InfoItem label="Waste Rate" value={`${(wasteRate * 100).toFixed(1)}%`} />
          <InfoItem label="Leftover Bagels" value={`${record.bagelsLeft}`} />
          {total > 0 && (
            <>
              <InfoItem label="Store Share" value={`${breakdown.store.percent.toFixed(1)}%`} />
              <InfoItem label="Uber Share" value={`${breakdown.uber.percent.toFixed(1)}%`} />
              <InfoItem label="DoorDash Share" value={`${breakdown.doordash.percent.toFixed(1)}%`} />
              <InfoItem label="Other Share" value={`${breakdown.other.percent.toFixed(1)}%`} />
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
