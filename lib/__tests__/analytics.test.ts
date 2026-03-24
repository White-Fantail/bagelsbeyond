import { describe, it, expect } from "vitest";
import {
  getSellThroughRate,
  getWasteRate,
  getAverageSales,
  getAverageSoldBagels,
  getChannelRatios,
  getRecentSummary,
} from "../analytics";
import type { DailyRecord } from "@/types";

describe("getSellThroughRate", () => {
  it("returns correct rate for normal case", () => {
    expect(getSellThroughRate({ bagelsBaked: 100, bagelsLeft: 20 })).toBeCloseTo(0.8);
  });
  it("returns 0 when bagelsBaked is 0", () => {
    expect(getSellThroughRate({ bagelsBaked: 0, bagelsLeft: 0 })).toBe(0);
  });
});

describe("getWasteRate", () => {
  it("returns correct rate for normal case", () => {
    expect(getWasteRate({ bagelsBaked: 100, bagelsLeft: 20 })).toBeCloseTo(0.2);
  });
  it("returns 0 when bagelsBaked is 0", () => {
    expect(getWasteRate({ bagelsBaked: 0, bagelsLeft: 0 })).toBe(0);
  });
});

describe("getAverageSales", () => {
  it("returns 0 for empty array", () => {
    expect(getAverageSales([])).toBe(0);
  });
  it("returns correct average", () => {
    const records = [
      { storeSales: 100, uberSales: 50, doordashSales: 25, otherSales: 25 },
      { storeSales: 200, uberSales: 0, doordashSales: 0, otherSales: 0 },
    ];
    expect(getAverageSales(records)).toBe(200);
  });
});

describe("getAverageSoldBagels", () => {
  it("returns 0 for empty array", () => {
    expect(getAverageSoldBagels([])).toBe(0);
  });
  it("returns correct average", () => {
    const records = [
      { bagelsBaked: 100, bagelsLeft: 10 },
      { bagelsBaked: 80, bagelsLeft: 20 },
    ];
    expect(getAverageSoldBagels(records)).toBe(75);
  });
});

describe("getChannelRatios", () => {
  it("returns all zeros when total is 0", () => {
    const result = getChannelRatios({
      storeSales: 0,
      uberSales: 0,
      doordashSales: 0,
      otherSales: 0,
    });
    expect(result).toEqual({ store: 0, uber: 0, doordash: 0, other: 0 });
  });
  it("returns correct percentages", () => {
    const result = getChannelRatios({
      storeSales: 50,
      uberSales: 25,
      doordashSales: 25,
      otherSales: 0,
    });
    expect(result.store).toBeCloseTo(50);
    expect(result.uber).toBeCloseTo(25);
    expect(result.doordash).toBeCloseTo(25);
    expect(result.other).toBe(0);
  });
});

describe("getRecentSummary", () => {
  it("returns zeros for empty array", () => {
    const result = getRecentSummary([], 7);
    expect(result).toEqual({ totalSales: 0, avgSales: 0, totalSold: 0, avgWasteRate: 0, count: 0 });
  });
  it("filters to last N days", () => {
    const now = new Date();
    const recent = new Date(now);
    recent.setDate(now.getDate() - 3);
    const old = new Date(now);
    old.setDate(now.getDate() - 30);

    const baseRecord = {
      id: "1",
      bagelsBaked: 100,
      bagelsLeft: 10,
      storeSales: 200,
      uberSales: 50,
      doordashSales: 30,
      otherSales: 20,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const records: DailyRecord[] = [
      { ...baseRecord, id: "1", date: recent },
      { ...baseRecord, id: "2", date: old },
    ];

    const result = getRecentSummary(records, 7);
    expect(result.count).toBe(1);
    expect(result.totalSales).toBe(300);
  });
});
