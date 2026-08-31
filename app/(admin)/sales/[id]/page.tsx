import Link from "next/link";
import { prisma } from "@/lib/db";
import { getTotalSales, getSoldBagels, getChannelBreakdown, formatCurrency, formatDate } from "@/lib/utils";
import DeleteRecordButton from "@/components/DeleteRecordButton";

type Props = { params: Promise<{ id: string }> };

export default async function SalesDetailPage({ params }: Props) {
  const { id } = await params;

  const record = await prisma.dailyRecord.findUnique({ where: { id } });

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/sales" className="text-sm text-amber-600 hover:underline">
            ← Sales List
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{formatDate(record.date)}</h1>
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

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
        <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">Sales Record</h2>
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
