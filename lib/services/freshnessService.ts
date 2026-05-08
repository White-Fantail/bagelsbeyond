import "server-only";
import { prisma } from "@/lib/db";
import { FreshnessLogType } from "@/app/generated/prisma/enums";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FreshnessStatus = "ok" | "warning" | "expired";

export type FreshnessLogRow = {
  id: string;
  productId: string;
  productName: string;
  categoryName: string | null;
  logType: FreshnessLogType;
  loggedAt: string;
  notes: string | null;
  rawDictation: string | null;
  createdByUserId: string | null;
  createdByUserName: string | null;
  createdAt: string;
};

export type FreshnessDashboardItem = {
  productId: string;
  productName: string;
  categoryId: string | null;
  categoryName: string | null;
  shelfLifeDays: number | null;
  storageType: string | null;
  latestLog: FreshnessLogRow | null;
  daysElapsed: number | null;
  daysRemaining: number | null;
  status: FreshnessStatus;
};

export type FreshnessCategoryStatusSummary = {
  expiredCount: number;
  warningCount: number;
  okCount: number;
  noLogCount: number;
};

export type FreshnessDashboardCategoryGroup = {
  categoryId: string;
  categoryName: string;
  freshnessSortOrder: number;
  summary: FreshnessCategoryStatusSummary;
  items: FreshnessDashboardItem[];
};

export type CreateFreshnessLogInput = {
  productId: string;
  logType: FreshnessLogType;
  loggedAt: Date;
  notes?: string | null;
  rawDictation?: string | null;
  createdByUserId?: string | null;
};

export type UpdateFreshnessLogInput = {
  logType?: FreshnessLogType;
  loggedAt?: Date;
  notes?: string | null;
  rawDictation?: string | null;
};

// ─── Status calculation ───────────────────────────────────────────────────────

export function computeFreshnessStatus(
  daysElapsed: number,
  shelfLifeDays: number
): FreshnessStatus {
  if (daysElapsed >= shelfLifeDays) return "expired";
  if (daysElapsed >= shelfLifeDays * 0.8) return "warning";
  return "ok";
}

function computeDaysElapsed(loggedAt: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - loggedAt.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function toFreshnessLogRow(r: {
  id: string;
  productId: string;
  logType: FreshnessLogType;
  loggedAt: Date;
  notes: string | null;
  rawDictation: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  product: { name: string; category: { name: string } | null };
  createdByUser?: { name: string } | null;
}): FreshnessLogRow {
  return {
    id: r.id,
    productId: r.productId,
    productName: r.product.name,
    categoryName: r.product.category?.name ?? null,
    logType: r.logType,
    loggedAt: r.loggedAt.toISOString(),
    notes: r.notes,
    rawDictation: r.rawDictation,
    createdByUserId: r.createdByUserId,
    createdByUserName: r.createdByUser?.name ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function addFreshnessLog(
  input: CreateFreshnessLogInput
): Promise<FreshnessLogRow> {
  const row = await prisma.freshnessLog.create({
    data: {
      productId: input.productId,
      logType: input.logType,
      loggedAt: input.loggedAt,
      notes: input.notes ?? null,
      rawDictation: input.rawDictation ?? null,
      createdByUserId: input.createdByUserId ?? null,
    },
    include: {
      product: { include: { category: { select: { name: true } } } },
      createdByUser: { select: { name: true } },
    },
  });
  return toFreshnessLogRow(row);
}

export async function updateFreshnessLog(
  id: string,
  input: UpdateFreshnessLogInput
): Promise<FreshnessLogRow> {
  const row = await prisma.freshnessLog.update({
    where: { id },
    data: {
      ...(input.logType !== undefined ? { logType: input.logType } : {}),
      ...(input.loggedAt !== undefined ? { loggedAt: input.loggedAt } : {}),
      ...("notes" in input ? { notes: input.notes ?? null } : {}),
      ...("rawDictation" in input ? { rawDictation: input.rawDictation ?? null } : {}),
    },
    include: {
      product: { include: { category: { select: { name: true } } } },
      createdByUser: { select: { name: true } },
    },
  });
  return toFreshnessLogRow(row);
}

export async function deleteFreshnessLog(id: string): Promise<void> {
  await prisma.freshnessLog.delete({ where: { id } });
}

export async function getFreshnessLogById(id: string): Promise<FreshnessLogRow | null> {
  const row = await prisma.freshnessLog.findUnique({
    where: { id },
    include: {
      product: { include: { category: { select: { name: true } } } },
      createdByUser: { select: { name: true } },
    },
  });
  if (!row) return null;
  return toFreshnessLogRow(row);
}

export async function listFreshnessLogs(filter: {
  productId?: string;
  logType?: FreshnessLogType;
  since?: Date;
  until?: Date;
} = {}): Promise<FreshnessLogRow[]> {
  const where: Record<string, unknown> = {};
  if (filter.productId) where.productId = filter.productId;
  if (filter.logType) where.logType = filter.logType;
  if (filter.since || filter.until) {
    where.loggedAt = {
      ...(filter.since ? { gte: filter.since } : {}),
      ...(filter.until ? { lte: filter.until } : {}),
    };
  }

  const rows = await prisma.freshnessLog.findMany({
    where,
    include: {
      product: { include: { category: { select: { name: true } } } },
      createdByUser: { select: { name: true } },
    },
    orderBy: { loggedAt: "desc" },
  });
  return rows.map(toFreshnessLogRow);
}

/**
 * Builds the freshness dashboard data.
 * For each active product, finds the latest DISPLAYED log.
 * Calculates days elapsed and remaining based on shelfLifeDays.
 * Results are sorted: expired first, then warning, then ok, then no-log products.
 */
export async function getFreshnessDashboard(): Promise<FreshnessDashboardCategoryGroup[]> {
  const products = await prisma.menuProduct.findMany({
    where: {
      isActive: true,
      category: {
        isFreshnessManaged: true,
      },
    },
    include: {
      category: { select: { id: true, name: true, freshnessSortOrder: true } },
      freshnessLogs: {
        where: { logType: FreshnessLogType.DISPLAYED },
        orderBy: { loggedAt: "desc" },
        take: 1,
        include: {
          product: { include: { category: { select: { name: true } } } },
          createdByUser: { select: { name: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const items: FreshnessDashboardItem[] = products.map((p) => {
    const latestLogRaw = p.freshnessLogs[0] ?? null;
    const latestLog = latestLogRaw ? toFreshnessLogRow(latestLogRaw) : null;

    let daysElapsed: number | null = null;
    let daysRemaining: number | null = null;
    let status: FreshnessStatus = "ok";

    if (latestLog && p.shelfLifeDays != null) {
      daysElapsed = computeDaysElapsed(new Date(latestLog.loggedAt));
      daysRemaining = p.shelfLifeDays - daysElapsed;
      status = computeFreshnessStatus(daysElapsed, p.shelfLifeDays);
    } else if (latestLog) {
      daysElapsed = computeDaysElapsed(new Date(latestLog.loggedAt));
    }

    return {
      productId: p.id,
      productName: p.name,
      categoryId: p.category?.id ?? null,
      categoryName: p.category?.name ?? null,
      shelfLifeDays: p.shelfLifeDays,
      storageType: p.storageType,
      latestLog,
      daysElapsed,
      daysRemaining,
      status,
    };
  });

  // Sort: expired → warning → ok (with log) → no log
  const statusOrder: Record<FreshnessStatus, number> = { expired: 0, warning: 1, ok: 2 };
  const sortedItems = items.sort((a, b) => {
    if (!a.latestLog && !b.latestLog) return 0;
    if (!a.latestLog) return 1;
    if (!b.latestLog) return -1;
    const sa = statusOrder[a.status];
    const sb = statusOrder[b.status];
    if (sa !== sb) return sa - sb;
    // Within same status: sort by daysRemaining ascending (most urgent first)
    if (a.daysRemaining != null && b.daysRemaining != null) {
      return a.daysRemaining - b.daysRemaining;
    }
    return 0;
  });

  const categorySortOrderMap = new Map<string, number>();
  for (const p of products) {
    if (p.category?.id) {
      categorySortOrderMap.set(p.category.id, p.category.freshnessSortOrder);
    }
  }

  const grouped = new Map<
    string,
    {
      categoryId: string;
      categoryName: string;
      freshnessSortOrder: number;
      items: FreshnessDashboardItem[];
    }
  >();

  for (const item of sortedItems) {
    if (!item.categoryId || !item.categoryName) continue;
    if (!grouped.has(item.categoryId)) {
      grouped.set(item.categoryId, {
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        freshnessSortOrder: categorySortOrderMap.get(item.categoryId) ?? 0,
        items: [],
      });
    }
    grouped.get(item.categoryId)!.items.push(item);
  }

  const toSummary = (groupItems: FreshnessDashboardItem[]): FreshnessCategoryStatusSummary => ({
    expiredCount: groupItems.filter((i) => i.status === "expired").length,
    warningCount: groupItems.filter((i) => i.status === "warning").length,
    okCount: groupItems.filter((i) => i.status === "ok" && i.latestLog).length,
    noLogCount: groupItems.filter((i) => !i.latestLog).length,
  });

  return Array.from(grouped.values())
    .map((g) => ({
      categoryId: g.categoryId,
      categoryName: g.categoryName,
      freshnessSortOrder: g.freshnessSortOrder,
      summary: toSummary(g.items),
      items: g.items,
    }))
    .sort(
      (a, b) =>
        a.freshnessSortOrder - b.freshnessSortOrder ||
        a.categoryName.localeCompare(b.categoryName)
    );
}
