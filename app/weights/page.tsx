export const dynamic = "force-dynamic";

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
        title="Predictions Weights"
        description="Manage sales prediction weights by factor"
      />
      <WeightsManager initialWeights={weights} />
    </div>
  );
}
