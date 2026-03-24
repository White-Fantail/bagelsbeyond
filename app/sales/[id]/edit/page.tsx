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
        <p className="text-gray-600">기록을 찾을 수 없습니다.</p>
        <Link href="/sales" className="text-amber-600 hover:underline text-sm">
          ← 매출 목록으로
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
          ← 상세 페이지로
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">매출 수정</h1>
        <p className="text-gray-500 mt-1">일별 매출 데이터를 수정합니다</p>
      </div>
      <SalesForm initialData={initialData} recordId={id} />
    </div>
  );
}
