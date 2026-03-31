import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDayOfWeekKey, safeNumber } from "@/lib/prediction-utils";

// Conservative nudge factor applied to the average relative error per factor.
const WEIGHT_LEARNING_RATE = 0.5;

// POST /api/weight-sets/optimize
// Analyses recent prediction accuracy vs actual sales and returns a suggested
// set of adjusted weights (does NOT persist anything – user must approve).
export async function POST() {
  try {
    // Load current active weights
    const currentWeights = await prisma.predictionWeight.findMany({ where: { isActive: true } });
    const weightMap: Record<string, number> = {};
    for (const w of currentWeights) weightMap[w.factorKey] = w.weightValue;

    // Load last 30 predictions with their factor snapshots
    const predictions = await prisma.salesPrediction.findMany({
      orderBy: { targetDate: "desc" },
      take: 30,
      include: { factorSnapshots: true },
    });

    // Fetch all actual daily records that fall within the prediction date range in one query
    if (predictions.length === 0) {
      const allWeights = await prisma.predictionWeight.findMany({ orderBy: { factorKey: "asc" } });
      return NextResponse.json({
        suggestedEntries: allWeights.map((w) => ({
          factorKey: w.factorKey,
          weightValue: w.weightValue,
          isActive: w.isActive,
          description: w.description ?? undefined,
        })),
        dataPointCount: 0,
        message: "No prediction history available — returning current weights unchanged",
      });
    }

    const earliest = new Date(predictions[predictions.length - 1].targetDate);
    earliest.setHours(0, 0, 0, 0);
    const latest = new Date(predictions[0].targetDate);
    latest.setHours(23, 59, 59, 999);

    const actualRecords = await prisma.dailyRecord.findMany({
      where: { date: { gte: earliest, lte: latest } },
    });

    // Build a lookup: date string (YYYY-MM-DD) → total sales
    const actualSalesMap: Record<string, number> = {};
    for (const r of actualRecords) {
      const key = new Date(r.date).toISOString().split("T")[0];
      actualSalesMap[key] =
        safeNumber(r.storeSales) +
        safeNumber(r.uberSales) +
        safeNumber(r.doordashSales) +
        safeNumber(r.otherSales);
    }

    // Compute per-factor errors
    type FactorError = { sum: number; count: number };
    const factorErrors: Record<string, FactorError> = {};
    let dataPointCount = 0;

    for (const pred of predictions) {
      const dateKey = new Date(pred.targetDate).toISOString().split("T")[0];
      const actualSales = actualSalesMap[dateKey];
      if (actualSales === undefined) continue;

      const predictedSales = safeNumber(pred.predictedSales);
      if (predictedSales === 0) continue;

      dataPointCount += 1;
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
    const suggested: Record<string, number> = { ...weightMap };

    for (const [key, err] of Object.entries(factorErrors)) {
      if (err.count < 3) continue; // not enough data for this factor
      const avgError = err.sum / err.count;
      const current = weightMap[key] ?? 0;
      const nudge = avgError * WEIGHT_LEARNING_RATE;
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

    return NextResponse.json({
      suggestedEntries,
      dataPointCount,
      message: `Suggestion based on ${dataPointCount} comparable prediction(s)`,
    });
  } catch (_error) {
    return NextResponse.json({ message: "Optimization failed" }, { status: 500 });
  }
}

