import { describe, it, expect, vi } from "vitest";

// Mock the db module so tests can import predictionService without a live Prisma client
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { calculateBaselineMetrics } from "../services/predictionService";
import type { DailyRecord } from "@/types";
import type { PredictionInput } from "../services/predictionService";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRecord(daysAgo: number, targetDate: Date, overrides: Partial<DailyRecord> = {}): DailyRecord {
  const date = new Date(targetDate);
  date.setDate(date.getDate() - daysAgo);
  return {
    id: `rec-${daysAgo}`,
    date,
    bagelsBaked: 100,
    bagelsLeft: 10,
    storeSales: 200,
    uberSales: 50,
    doordashSales: 30,
    otherSales: 20,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeInput(
  targetDate: Date,
  records: DailyRecord[],
  sameDayRecords?: DailyRecord[]
): PredictionInput {
  return {
    targetDate,
    recentRecords: records,
    sameDayRecords: sameDayRecords ?? [],
    weights: {},
    externalFactors: {},
    settings: { defaultTargetWasteRatio: 0.05, defaultSafetyBuffer: 1.1, predictionLookbackDays: 365 },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("calculateBaselineMetrics — recency weighting", () => {
  it("returns fallback values when no records are provided", () => {
    const targetDate = new Date("2025-06-15");
    const metrics = calculateBaselineMetrics(makeInput(targetDate, []));
    expect(metrics.avgSales).toBe(300);
    expect(metrics.avgBagelsSold).toBe(60);
    expect(metrics.dataPointCount).toBe(0);
  });

  it("uses all records regardless of how old they are", () => {
    const targetDate = new Date("2025-06-15");
    // Include a record from 90 days ago (well beyond the old 30-day limit)
    const records = [makeRecord(5, targetDate), makeRecord(90, targetDate)];
    const metrics = calculateBaselineMetrics(makeInput(targetDate, records));
    expect(metrics.dataPointCount).toBe(2);
  });

  it("recent records carry higher weight than old ones", () => {
    const targetDate = new Date("2025-06-15");

    // Scenario A: recent record has high sales, old record has low sales
    const recordsA = [
      makeRecord(1, targetDate, { storeSales: 500, uberSales: 0, doordashSales: 0, otherSales: 0 }),
      makeRecord(90, targetDate, { storeSales: 100, uberSales: 0, doordashSales: 0, otherSales: 0 }),
    ];

    // Scenario B: recent record has low sales, old record has high sales
    const recordsB = [
      makeRecord(1, targetDate, { storeSales: 100, uberSales: 0, doordashSales: 0, otherSales: 0 }),
      makeRecord(90, targetDate, { storeSales: 500, uberSales: 0, doordashSales: 0, otherSales: 0 }),
    ];

    const metricsA = calculateBaselineMetrics(makeInput(targetDate, recordsA));
    const metricsB = calculateBaselineMetrics(makeInput(targetDate, recordsB));

    // Scenario A (recent=high) should produce a higher avgSales than Scenario B (recent=low)
    expect(metricsA.avgSales).toBeGreaterThan(metricsB.avgSales);
  });

  it("a very recent record dominates when the old record is far away", () => {
    const targetDate = new Date("2025-06-15");
    // Record from yesterday vs 180 days ago — the recent one should dominate
    const records = [
      makeRecord(1, targetDate, { storeSales: 1000, uberSales: 0, doordashSales: 0, otherSales: 0, bagelsBaked: 200, bagelsLeft: 0 }),
      makeRecord(180, targetDate, { storeSales: 100, uberSales: 0, doordashSales: 0, otherSales: 0, bagelsBaked: 20, bagelsLeft: 0 }),
    ];
    const metrics = calculateBaselineMetrics(makeInput(targetDate, records));

    // avgSales should be much closer to 1000 than to 550 (simple average)
    expect(metrics.avgSales).toBeGreaterThan(700);
  });

  it("same-day records are also recency-weighted", () => {
    const targetDate = new Date("2025-06-15"); // Sunday
    // Same-day (Sunday) records
    const sameDay = [
      makeRecord(7, targetDate, { storeSales: 800, uberSales: 0, doordashSales: 0, otherSales: 0 }),
      makeRecord(84, targetDate, { storeSales: 200, uberSales: 0, doordashSales: 0, otherSales: 0 }),
    ];
    const records = [...sameDay, makeRecord(3, targetDate)]; // one non-same-day record
    const metrics = calculateBaselineMetrics(makeInput(targetDate, records, sameDay));

    // sameDayAvgSales should be closer to 800 (recent) than to 500 (simple average)
    expect(metrics.sameDayAvgSales).toBeGreaterThan(600);
  });

  it("waste rate and sold/baked ratio are recency-weighted", () => {
    const targetDate = new Date("2025-06-15");

    // Recent records: low waste (bagelsLeft=5 out of 100 → 5%)
    // Old records: high waste (bagelsLeft=40 out of 100 → 40%)
    const records = [
      makeRecord(1, targetDate, { bagelsBaked: 100, bagelsLeft: 5, storeSales: 200, uberSales: 0, doordashSales: 0, otherSales: 0 }),
      makeRecord(90, targetDate, { bagelsBaked: 100, bagelsLeft: 40, storeSales: 200, uberSales: 0, doordashSales: 0, otherSales: 0 }),
    ];
    const metrics = calculateBaselineMetrics(makeInput(targetDate, records));

    // avgWasteRate should be closer to 0.05 (recent) than 0.225 (simple average).
    // With tiered weights (1-day → 1.0, 90-day → 0.4) the result is ~0.15, which
    // is well below the simple midpoint of 0.225.
    expect(metrics.avgWasteRate).toBeLessThan(0.20);
    // avgSoldToBakedRatio should be closer to recent high sell-through.
    // With tiered weights the result is ~0.85, above the simple average of 0.775.
    expect(metrics.avgSoldToBakedRatio).toBeGreaterThan(0.82);
  });

  it("blends same-day and overall averages (60/40) when same-day records exist", () => {
    const targetDate = new Date("2025-06-15");
    const records = [makeRecord(3, targetDate, { storeSales: 200, uberSales: 0, doordashSales: 0, otherSales: 0 })];
    const sameDay = [makeRecord(7, targetDate, { storeSales: 400, uberSales: 0, doordashSales: 0, otherSales: 0 })];
    const allRecords = [...records, ...sameDay];
    const metrics = calculateBaselineMetrics(makeInput(targetDate, allRecords, sameDay));

    // blendedAvgSales = 0.6 * sameDayAvg + 0.4 * overallAvg
    expect(metrics.blendedAvgSales).toBeGreaterThan(metrics.avgSales);
  });

  it("falls back to overall averages when no same-day records are provided", () => {
    const targetDate = new Date("2025-06-15");
    const records = [makeRecord(3, targetDate, { storeSales: 300, uberSales: 0, doordashSales: 0, otherSales: 0 })];
    const metrics = calculateBaselineMetrics(makeInput(targetDate, records, []));

    expect(metrics.blendedAvgSales).toBeCloseTo(metrics.avgSales);
  });
});

// ─── Lookback window filtering ────────────────────────────────────────────────
// buildPredictionInput filters records by predictionLookbackDays before calling
// calculateBaselineMetrics. These tests verify that the downstream calculation
// only sees the records that fall within the window (the filtering itself is an
// integration concern; here we confirm the baseline is correct when older records
// are excluded).

describe("calculateBaselineMetrics — predictionLookbackDays effect", () => {
  it("excludes records beyond the lookback window from the baseline", () => {
    const targetDate = new Date("2025-06-15");

    // Simulate a 90-day lookback: only records within 90 days are included.
    // A record at 91 days would be excluded by buildPredictionInput.
    const within = [
      makeRecord(1,  targetDate, { storeSales: 400, uberSales: 0, doordashSales: 0, otherSales: 0 }),
      makeRecord(89, targetDate, { storeSales: 400, uberSales: 0, doordashSales: 0, otherSales: 0 }),
    ];

    // With the old behavior (no filter), an ancient record would also be included.
    const withAncient = [
      ...within,
      makeRecord(400, targetDate, { storeSales: 0, uberSales: 0, doordashSales: 0, otherSales: 0 }),
    ];

    const metricsFiltered = calculateBaselineMetrics(makeInput(targetDate, within));
    const metricsUnfiltered = calculateBaselineMetrics(makeInput(targetDate, withAncient));

    // The filtered baseline (all $400) should be higher than unfiltered (pulled down by $0 record)
    expect(metricsFiltered.avgSales).toBeGreaterThan(metricsUnfiltered.avgSales);
    // Filtered should equal roughly 400
    expect(metricsFiltered.avgSales).toBeCloseTo(400, 0);
  });

  it("returns fallback values when all records are outside the lookback window (empty recentRecords)", () => {
    // buildPredictionInput would pass an empty array when every record is older than
    // predictionLookbackDays. The baseline must gracefully return fallback values.
    const targetDate = new Date("2025-06-15");
    const metrics = calculateBaselineMetrics(makeInput(targetDate, []));

    expect(metrics.avgSales).toBe(300);
    expect(metrics.avgBagelsSold).toBe(60);
    expect(metrics.dataPointCount).toBe(0);
  });

  it("correctly uses only records within a short window (30 days)", () => {
    const targetDate = new Date("2025-06-15");

    // Only records from the last 30 days should be present (simulating a 30-day lookback)
    const records = [
      makeRecord(5,  targetDate, { storeSales: 600, uberSales: 0, doordashSales: 0, otherSales: 0 }),
      makeRecord(29, targetDate, { storeSales: 600, uberSales: 0, doordashSales: 0, otherSales: 0 }),
    ];

    const metrics = calculateBaselineMetrics(
      { ...makeInput(targetDate, records), settings: { defaultTargetWasteRatio: 0.05, defaultSafetyBuffer: 1.1, predictionLookbackDays: 30 } }
    );

    expect(metrics.dataPointCount).toBe(2);
    expect(metrics.avgSales).toBeCloseTo(600, 0);
  });
});
