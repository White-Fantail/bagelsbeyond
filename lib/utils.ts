import type { DailyRecord } from "@/types";

export function getTotalSales(record: Pick<DailyRecord, "storeSales" | "uberSales" | "doordashSales" | "otherSales">): number {
  return record.storeSales + record.uberSales + record.doordashSales + record.otherSales;
}

export function getSoldBagels(record: Pick<DailyRecord, "bagelsBaked" | "bagelsLeft">): number {
  return record.bagelsBaked - record.bagelsLeft;
}

export function getWasteBagels(record: Pick<DailyRecord, "bagelsBaked" | "bagelsLeft">): number {
  return record.bagelsLeft;
}

export function getChannelBreakdown(record: Pick<DailyRecord, "storeSales" | "uberSales" | "doordashSales" | "otherSales">) {
  const total = getTotalSales(record);
  if (total === 0) {
    return {
      store: { amount: 0, percent: 0 },
      uber: { amount: 0, percent: 0 },
      doordash: { amount: 0, percent: 0 },
      other: { amount: 0, percent: 0 },
    };
  }
  return {
    store: { amount: record.storeSales, percent: (record.storeSales / total) * 100 },
    uber: { amount: record.uberSales, percent: (record.uberSales / total) * 100 },
    doordash: { amount: record.doordashSales, percent: (record.doordashSales / total) * 100 },
    other: { amount: record.otherSales, percent: (record.otherSales / total) * 100 },
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
