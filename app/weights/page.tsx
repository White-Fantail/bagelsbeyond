import { prisma } from "@/lib/db";
import PageHeader from "@/components/PageHeader";
import WeightsManager from "@/components/WeightsManager";

export default async function WeightsPage() {
  const weights = await prisma.predictionWeight.findMany({
    orderBy: { factorKey: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="예측 가중치"
        description="요인별 매출 예측 가중치를 관리합니다"
      />
      <WeightsManager initialWeights={weights} />
    </div>
  );
}
