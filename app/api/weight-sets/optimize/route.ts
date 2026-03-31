import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDayOfWeekKey, safeNumber } from "@/lib/prediction-utils";

// POST /api/weight-sets/optimize
// Analyses recent prediction accuracy vs actual sales and returns a suggested
// set of adjusted weights (does NOT persist anything – user must approve).
export async function POST() {
  try {
    // Load current active weights
    const currentWeights = await prisma.predictionWeight.findMany({ where: { isActive: true } });
    const weightMap: Record<string, number> = {};
    for (const w of currentWeights) weightMap[w.factorKey] = w.weightValue;

    // Load last 30 predictions that have matching actual records
    const predictions = await prisma.salesPrediction.findMany({
      orderBy: { targetDate: "desc" },
      take: 30,
      include: { factorSnapshots: true },
    });

    // For each prediction, find actual record and compute per-factor error
    type FactorError = { sum: number; count: number };
    const factorErrors: Record<string, FactorError> = {};

    for (const pred of predictions) {
      const dayStart = new Date(pred.targetDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(pred.targetDate);
      dayEnd.setHours(23, 59, 59, 999);

      const actual = await prisma.dailyRecord.findFirst({
        where: { date: { gte: dayStart, lte: dayEnd } },
      });
      if (!actual) continue;

      const actualSales =
        safeNumber(actual.storeSales) +
        safeNumber(actual.uberSales) +
        safeNumber(actual.doordashSales) +
        safeNumber(actual.otherSales);

      const predictedSales = safeNumber(pred.predictedSales);
      if (predictedSales === 0) continue;

      const relativeError = (actualSales - predictedSales) / predictedSales;

      for (const snap of pred.factorSnapshots) {
        if (!factorErrors[snap.factorKey]) factorErrors[snap.factorKey] = { sum: 0, count: 0 };
        factorErrors[snap.factorKey].sum += relativeError;
        factorErrors[snap.factorKey].count += 1;
      }

      // Also track day-of-week key for this prediction
      const dowKey = getDayOfWeekKey(new Date(pred.targetDate));
      if (!factorErrors[dowKey]) factorErrors[dowKey] = { sum: 0, count: 0 };
      factorErrors[dowKey].sum += relativeError;
      factorErrors[dowKey].count += 1;
    }

    // Build suggested weights: nudge each weight by the average error
    const LEARNING_RATE = 0.5; // conservative
    const suggested: Record<string, number> = { ...weightMap };

    for (const [key, err] of Object.entries(factorErrors)) {
      if (err.count < 3) continue; // not enough data
      const avgError = err.sum / err.count;
      const current = weightMap[key] ?? 0;
      const nudge = avgError * LEARNING_RATE;
      // Clamp to [-1, 1]
      suggested[key] = Math.max(-1, Math.min(1, current + nudge));
    }

    // Build the final list — keep all existing keys, fill in suggested values
    const allWeights = await prisma.predictionWeight.findMany({ orderBy: { factorKey: "asc" } });
    const suggestedEntries = allWeights.map((w) => ({
      factorKey: w.factorKey,
      weightValue: suggested[w.factorKey] !== undefined ? Math.round(suggested[w.factorKey] * 1000) / 1000 : w.weightValue,
      isActive: w.isActive,
      description: w.description ?? undefined,
    }));

    const dataPointCount = predictions.filter((p) => p.factorSnapshots.length > 0).length;

    return NextResponse.json({
      suggestedEntries,
      dataPointCount,
      message: `Suggestion based on ${dataPointCount} comparable prediction(s)`,
    });
  } catch (_error) {
    return NextResponse.json({ message: "Optimization failed" }, { status: 500 });
  }
}
