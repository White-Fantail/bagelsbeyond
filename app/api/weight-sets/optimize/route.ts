import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDayOfWeekKey, safeNumber } from "@/lib/prediction-utils";

// Conservative nudge factor: how far we move the current weight toward the
// computed ideal on each optimize run.
const WEIGHT_LEARNING_RATE = 0.4;

// Minimum number of sales records in a factor group before we trust the signal
// enough to suggest a weight change for that factor.
const MIN_FACTOR_DATA_POINTS = 3;

// Tiered recency weights that mirror the prediction baseline logic:
//  • last 30 days      → full weight  (1.0)
//  • 31–120 days ago   → medium weight (0.4)
//  • 120+ days ago     → low weight   (0.1)
function computeTieredWeight(today: Date, recordDate: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysAgo = Math.max(0, (today.getTime() - new Date(recordDate).getTime()) / msPerDay);
  if (daysAgo <= 30) return 1.0;
  if (daysAgo <= 120) return 0.4;
  return 0.1;
}

function tieredWeightedAvg(values: number[], weights: number[]): number {
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (totalWeight === 0) return 0;
  return values.reduce((s, v, i) => s + v * weights[i], 0) / totalWeight;
}

// POST /api/weight-sets/optimize
// Derives suggested weights from ALL historical bagel sales records using tiered
// recency weighting.  Does NOT persist anything — the user must approve the result.
export async function POST() {
  try {
    // Load current active weights
    const currentWeights = await prisma.predictionWeight.findMany({ where: { isActive: true } });
    const weightMap: Record<string, number> = {};
    for (const w of currentWeights) weightMap[w.factorKey] = w.weightValue;

    // Load all sales records with their external factors
    const allRecords = await prisma.dailyRecord.findMany({
      orderBy: { date: "desc" },
      include: { externalFactor: true },
    });

    if (allRecords.length === 0) {
      const allWeights = await prisma.predictionWeight.findMany({ orderBy: { factorKey: "asc" } });
      return NextResponse.json({
        suggestedEntries: allWeights.map((w) => ({
          factorKey: w.factorKey,
          weightValue: w.weightValue,
          isActive: w.isActive,
          description: w.description ?? undefined,
        })),
        dataPointCount: 0,
        message: "No sales history available — returning current weights unchanged",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Pre-compute total sales, tiered recency weight, and day-of-week for each record
    const records = allRecords.map((r) => ({
      ...r,
      totalSales:
        safeNumber(r.storeSales) +
        safeNumber(r.uberSales) +
        safeNumber(r.doordashSales) +
        safeNumber(r.otherSales),
      recencyWeight: computeTieredWeight(today, r.date),
      dow: getDayOfWeekKey(new Date(r.date)),
    }));

    // Overall tiered-weighted average — used as baseline for day-of-week comparisons
    const overallAvg = tieredWeightedAvg(
      records.map((r) => r.totalSales),
      records.map((r) => r.recencyWeight)
    );

    if (overallAvg === 0) {
      const allWeights = await prisma.predictionWeight.findMany({ orderBy: { factorKey: "asc" } });
      return NextResponse.json({
        suggestedEntries: allWeights.map((w) => ({
          factorKey: w.factorKey,
          weightValue: w.weightValue,
          isActive: w.isActive,
          description: w.description ?? undefined,
        })),
        dataPointCount: records.length,
        message: "Sales totals are zero — returning current weights unchanged",
      });
    }

    const suggested: Record<string, number> = { ...weightMap };

    // ── Day-of-week weights ────────────────────────────────────────────────────
    // Each day's suggested weight is the ratio of its tiered-weighted average
    // sales to the overall tiered-weighted average, minus 1.
    const daysOfWeek = [
      "sunday", "monday", "tuesday", "wednesday",
      "thursday", "friday", "saturday",
    ] as const;

    for (const dowKey of daysOfWeek) {
      const dowRecords = records.filter((r) => r.dow === dowKey);
      if (dowRecords.length < MIN_FACTOR_DATA_POINTS) continue;

      const dowAvg = tieredWeightedAvg(
        dowRecords.map((r) => r.totalSales),
        dowRecords.map((r) => r.recencyWeight)
      );

      const rawSuggested = dowAvg / overallAvg - 1;
      const current = weightMap[dowKey] ?? 0;
      suggested[dowKey] = Math.max(-1, Math.min(1, current + (rawSuggested - current) * WEIGHT_LEARNING_RATE));
    }

    // ── Binary event / condition factors ──────────────────────────────────────
    // For each factor we compare the tiered-weighted average on "active" days vs
    // "inactive" days to derive a ratio-based suggested weight.
    type BinaryFactorDef = {
      key: string;
      isActive: (r: (typeof records)[0]) => boolean;
    };

    const binaryFactors: BinaryFactorDef[] = [
      { key: "weather_rain",   isActive: (r) => safeNumber(r.externalFactor?.rainMm, 0) > 0 },
      { key: "weather_hot",    isActive: (r) => safeNumber(r.externalFactor?.maxTemp, 0) > 28 },
      { key: "holiday",        isActive: (r) => !!r.externalFactor?.holidayName },
      { key: "local_event",    isActive: (r) => !!r.externalFactor?.localEventName },
      { key: "school_holiday", isActive: (r) => r.externalFactor?.schoolHoliday === true },
    ];

    for (const factor of binaryFactors) {
      const activeRecords   = records.filter((r) =>  factor.isActive(r));
      const inactiveRecords = records.filter((r) => !factor.isActive(r));

      if (activeRecords.length < MIN_FACTOR_DATA_POINTS || inactiveRecords.length < MIN_FACTOR_DATA_POINTS) continue;

      const activeAvg = tieredWeightedAvg(
        activeRecords.map((r) => r.totalSales),
        activeRecords.map((r) => r.recencyWeight)
      );
      const inactiveAvg = tieredWeightedAvg(
        inactiveRecords.map((r) => r.totalSales),
        inactiveRecords.map((r) => r.recencyWeight)
      );

      if (inactiveAvg === 0) continue;

      const rawSuggested = activeAvg / inactiveAvg - 1;
      const current = weightMap[factor.key] ?? 0;
      suggested[factor.key] = Math.max(-1, Math.min(1, current + (rawSuggested - current) * WEIGHT_LEARNING_RATE));
    }

    // Build the final list — union of existing weight records and any factors
    // derived above (handles the case where no weights exist yet).
    const allWeights = await prisma.predictionWeight.findMany({ orderBy: { factorKey: "asc" } });
    const weightsLookup = new Map(allWeights.map((w) => [w.factorKey as string, w]));
    const allKeys = [...new Set([...weightsLookup.keys(), ...Object.keys(suggested)])].sort();
    const suggestedEntries = allKeys.map((key) => {
      const existing = weightsLookup.get(key);
      return {
        factorKey: key,
        weightValue:
          suggested[key] !== undefined
            ? Math.round(suggested[key] * 1000) / 1000
            : (existing?.weightValue ?? 0),
        isActive: existing?.isActive ?? true,
        description: existing?.description ?? undefined,
      };
    });

    return NextResponse.json({
      suggestedEntries,
      dataPointCount: records.length,
      message: `Suggestion based on ${records.length} sales record(s) with tiered recency weighting`,
    });
  } catch (_error) {
    return NextResponse.json({ message: "Optimization failed" }, { status: 500 });
  }
}

