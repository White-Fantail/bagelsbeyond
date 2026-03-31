export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import PageHeader from "@/components/PageHeader";
import WeightsManager from "@/components/WeightsManager";
import WeightSetsManager from "@/components/WeightSetsManager";

export default async function WeightsPage() {
  const [weights, weightSets] = await Promise.all([
    prisma.predictionWeight.findMany({ orderBy: { factorKey: "asc" } }),
    prisma.weightSet.findMany({ orderBy: { version: "desc" } }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Predictions Weights"
        description="Manage sales prediction weights by factor"
      />
      <WeightsManager initialWeights={weights} />

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Weight Set Versions</h2>
        <p className="text-sm text-gray-500 mb-4">
          Save the current weights as a named version, auto-optimize from historical accuracy, compare versions side-by-side, or roll back to a previous set.
        </p>
        <WeightSetsManager initialSets={weightSets} />
      </div>
    </div>
  );
}

