import type { DailyRecord } from "@/types";

export function getSellThroughRate(
  record: Pick<DailyRecord, "bagelsBaked" | "bagelsLeft">
): number {
  if (record.bagelsBaked === 0) return 0;
  return (record.bagelsBaked - record.bagelsLeft) / record.bagelsBaked;
}

export function getWasteRate(
  record: Pick<DailyRecord, "bagelsBaked" | "bagelsLeft">
): number {
  if (record.bagelsBaked === 0) return 0;
  return record.bagelsLeft / record.bagelsBaked;
}

export function getAverageSales(
  records: Pick<DailyRecord, "storeSales" | "uberSales" | "doordashSales" | "otherSales">[]
): number {
  if (records.length === 0) return 0;
  const total = records.reduce(
    (sum, r) => sum + r.storeSales + r.uberSales + r.doordashSales + r.otherSales,
    0
  );
  return total / records.length;
}

export function getAverageSoldBagels(
  records: Pick<DailyRecord, "bagelsBaked" | "bagelsLeft">[]
): number {
  if (records.length === 0) return 0;
  const total = records.reduce(
    (sum, r) => sum + (r.bagelsBaked - r.bagelsLeft),
    0
  );
  return total / records.length;
}

export function getChannelRatios(
  record: Pick<DailyRecord, "storeSales" | "uberSales" | "doordashSales" | "otherSales">
): { store: number; uber: number; doordash: number; other: number } {
  const total =
    record.storeSales + record.uberSales + record.doordashSales + record.otherSales;
  if (total === 0) return { store: 0, uber: 0, doordash: 0, other: 0 };
  return {
    store: (record.storeSales / total) * 100,
    uber: (record.uberSales / total) * 100,
    doordash: (record.doordashSales / total) * 100,
    other: (record.otherSales / total) * 100,
  };
}

export function getRecentSummary(
  records: DailyRecord[],
  days: number
): { totalSales: number; avgSales: number; totalSold: number; avgWasteRate: number; count: number } {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const filtered = records.filter((r) => new Date(r.date) >= cutoff);

  if (filtered.length === 0) {
    return { totalSales: 0, avgSales: 0, totalSold: 0, avgWasteRate: 0, count: 0 };
  }

  const totalSales = filtered.reduce(
    (sum, r) => sum + r.storeSales + r.uberSales + r.doordashSales + r.otherSales,
    0
  );
  const totalSold = filtered.reduce(
    (sum, r) => sum + (r.bagelsBaked - r.bagelsLeft),
    0
  );
  const avgWasteRate =
    filtered.reduce((sum, r) => sum + getWasteRate(r), 0) / filtered.length;

  return {
    totalSales,
    avgSales: totalSales / filtered.length,
    totalSold,
    avgWasteRate,
    count: filtered.length,
  };
}
