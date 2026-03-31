import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/weight-sets/[id]/activate
// Activates the requested weight set and overwrites PredictionWeight with its entries.
export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    const set = await prisma.weightSet.findUnique({
      where: { id },
      include: { entries: true },
    });

    if (!set) return NextResponse.json({ message: "Weight set not found" }, { status: 404 });

    // Run in a transaction: deactivate all sets, activate this one, replace PredictionWeight rows
    await prisma.$transaction(async (tx) => {
      // 1. Mark all sets inactive
      await tx.weightSet.updateMany({ data: { isActive: false } });

      // 2. Activate the selected set
      await tx.weightSet.update({ where: { id }, data: { isActive: true } });

      // 3. Replace all PredictionWeight rows with this set's entries
      await tx.predictionWeight.deleteMany();
      if (set.entries.length > 0) {
        await tx.predictionWeight.createMany({
          data: set.entries.map((e) => ({
            factorKey: e.factorKey,
            weightValue: e.weightValue,
            isActive: e.isActive,
            description: e.description,
          })),
        });
      }
    });

    const updated = await prisma.weightSet.findUnique({
      where: { id },
      include: { entries: { orderBy: { factorKey: "asc" } } },
    });

    return NextResponse.json(updated);
  } catch (_error) {
    return NextResponse.json({ message: "Activation failed" }, { status: 500 });
  }
}
