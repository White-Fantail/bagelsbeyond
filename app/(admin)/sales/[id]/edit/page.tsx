import { prisma } from "@/lib/db";
import SalesForm from "@/components/SalesForm";
import Link from "next/link";
import type { SalesFormSchema } from "@/lib/validations";

type Props = { params: Promise<{ id: string }> };

export default async function EditSalesPage({ params }: Props) {
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

  const ef = record.externalFactor;
  const initialData: SalesFormSchema = {
    date: record.date.toISOString().split("T")[0],
    bagelsBaked: record.bagelsBaked,
    bagelsLeft: record.bagelsLeft,
    storeSales: record.storeSales,
    uberSales: record.uberSales,
    doordashSales: record.doordashSales,
    otherSales: record.otherSales,
    notes: record.notes ?? undefined,
    weatherSummary: ef?.weatherSummary ?? undefined,
    minTemp: ef?.minTemp ?? undefined,
    maxTemp: ef?.maxTemp ?? undefined,
    rainMm: ef?.rainMm ?? undefined,
    windKph: ef?.windKph ?? undefined,
    holidayName: ef?.holidayName ?? undefined,
    localEventName: ef?.localEventName ?? undefined,
    schoolHoliday: ef?.schoolHoliday ?? false,
    nzNewsSummary: ef?.nzNewsSummary ?? undefined,
    worldNewsSummary: ef?.worldNewsSummary ?? undefined,
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/sales/${id}`} className="text-sm text-amber-600 hover:underline">
          ← Back to Details
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Sales Edit</h1>
        <p className="text-gray-500 mt-1">Edit daily sales data</p>
      </div>
      <SalesForm initialData={initialData} recordId={id} />
    </div>
  );
}
