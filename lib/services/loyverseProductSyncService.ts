import "server-only";

import { prisma } from "@/lib/db";
import { LoyverseSyncStatus } from "@/app/generated/prisma/enums";
import { slugify } from "@/lib/utils";

type LoyverseCategory = {
  id: string;
  name: string;
};

type LoyverseModifierOption = {
  id: string;
  name: string;
  priceDelta: number;
};

type LoyverseModifierGroup = {
  id: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  options: LoyverseModifierOption[];
};

type LoyverseItem = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  categoryId: string | null;
  sellingPrice: number | null;
  isActive: boolean;
  modifierGroups: LoyverseModifierGroup[];
};

type SyncCounters = {
  categoriesAdded: number;
  categoriesUpdated: number;
  productsAdded: number;
  productsUpdated: number;
  modifiersAdded: number;
  modifiersUpdated: number;
};

export type LoyverseSyncSummary = SyncCounters & {
  logId: string;
  status: LoyverseSyncStatus;
  categoriesFetched: number;
  productsFetched: number;
  warnings: string[];
};

const LOYVERSE_API_BASE = "https://api.loyverse.com/v1.0";

function normalizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeOptionalString(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }
  return fallback;
}

function normalizeDecimal(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value.toFixed(2));
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return Number(parsed.toFixed(2));
    }
  }
  return null;
}

function normalizeMoney(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number((value / 100).toFixed(2));
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return Number((parsed / 100).toFixed(2));
    }
  }
  if (value && typeof value === "object") {
    const amount = (value as { amount?: unknown }).amount;
    return normalizeMoney(amount);
  }
  return null;
}

function normalizePrice(value: unknown): number | null {
  const decimal = normalizeDecimal(value);
  if (decimal !== null) return decimal;
  if (value && typeof value === "object") {
    const amount = (value as { amount?: unknown }).amount;
    return normalizePrice(amount);
  }
  return null;
}

function pickFirstPrice(source: Record<string, unknown>): number | null {
  const centCandidates = [
    "price_in_cents",
    "price_delta_in_cents",
    "additional_price_in_cents",
  ];
  for (const key of centCandidates) {
    const value = source[key];
    const normalized = normalizeMoney(value);
    if (normalized !== null) return normalized;
  }

  const priceCandidates = [
    "price",
    "price_delta",
    "default_price",
    "default_price_money",
    "additional_price",
  ];
  for (const key of priceCandidates) {
    const value = source[key];
    const normalized = normalizePrice(value);
    if (normalized !== null) return normalized;
  }

  return null;
}

function toLoyverseCategory(raw: unknown): LoyverseCategory | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = normalizeString(row.id);
  const name = normalizeString(row.name);
  if (!id || !name) return null;
  return { id, name };
}

function extractModifierOptions(raw: unknown): LoyverseModifierOption[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((optionRaw) => {
      if (!optionRaw || typeof optionRaw !== "object") return null;
      const row = optionRaw as Record<string, unknown>;
      const id =
        normalizeString(row.id) ||
        normalizeString(row.modifier_id) ||
        normalizeString(row.option_id);
      const name =
        normalizeString(row.name) ||
        normalizeString(row.modifier_name) ||
        normalizeString(row.option_name);
      if (!id || !name) return null;

      return {
        id,
        name,
        priceDelta: pickFirstPrice(row) ?? 0,
      };
    })
    .filter((row): row is LoyverseModifierOption => row !== null);
}

function extractModifierGroups(raw: unknown): LoyverseModifierGroup[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((groupRaw) => {
      if (!groupRaw || typeof groupRaw !== "object") return null;
      const row = groupRaw as Record<string, unknown>;
      const id =
        normalizeString(row.id) ||
        normalizeString(row.modifier_list_id) ||
        normalizeString(row.group_id);
      const name =
        normalizeString(row.name) ||
        normalizeString(row.modifier_list_name) ||
        normalizeString(row.group_name);
      if (!id || !name) return null;

      const options = extractModifierOptions(
        row.options ?? row.modifiers ?? row.items ?? row.variants ?? []
      );
      const minSelections = normalizeInt(row.min_selections, 0);
      const maxSelections = normalizeInt(
        row.max_selections,
        options.length > 0 ? options.length : 1
      );
      const isRequired =
        Boolean(row.required ?? row.is_required) || minSelections > 0;

      return {
        id,
        name,
        isRequired,
        minSelections,
        maxSelections: maxSelections > 0 ? maxSelections : 1,
        options,
      };
    })
    .filter((row): row is LoyverseModifierGroup => row !== null);
}

function toLoyverseItem(raw: unknown): LoyverseItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;

  const id = normalizeString(row.id);
  const name = normalizeString(row.item_name) || normalizeString(row.name);
  if (!id || !name) return null;

  const variants = Array.isArray(row.variants) ? row.variants : [];
  const variantPrice =
    variants.length > 0 && typeof variants[0] === "object" && variants[0] !== null
      ? pickFirstPrice(variants[0] as Record<string, unknown>)
      : null;

  const modifierGroups = extractModifierGroups(
    row.modifier_groups ?? row.option_groups ?? row.modifier_lists ?? []
  );

  return {
    id,
    name,
    sku: normalizeOptionalString(row.sku),
    description: normalizeOptionalString(row.description),
    categoryId: normalizeOptionalString(row.category_id),
    sellingPrice: pickFirstPrice(row) ?? variantPrice,
    isActive: !Boolean(row.deleted_at ?? row.is_deleted),
    modifierGroups,
  };
}

async function loyverseGetCollection<T>(
  path: string,
  collectionKey: string,
  mapper: (row: unknown) => T | null,
  accessToken: string
): Promise<T[]> {
  const result: T[] = [];
  let cursor: string | null = null;

  do {
    const url = new URL(`${LOYVERSE_API_BASE}/${path}`);
    url.searchParams.set("limit", "250");
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `******
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Loyverse API ${path} failed (${res.status}): ${text}`);
    }

    const payload = (await res.json()) as Record<string, unknown>;
    const rows = Array.isArray(payload[collectionKey]) ? payload[collectionKey] : [];
    for (const row of rows) {
      const parsed = mapper(row);
      if (parsed) result.push(parsed);
    }

    const next = payload.cursor ?? payload.next_cursor;
    cursor = typeof next === "string" && next.length > 0 ? next : null;
  } while (cursor);

  return result;
}

async function createUniqueCategorySlug(baseName: string): Promise<string> {
  const base = slugify(baseName) || "loyverse-category";
  let candidate = base;
  let seq = 2;

  while (true) {
    const existing = await prisma.productCategory.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
    candidate = `${base}-${seq}`;
    seq += 1;
  }
}

async function createCategoryBackup(categoryId: string): Promise<void> {
  const original = await prisma.productCategory.findUnique({ where: { id: categoryId } });
  if (!original) return;

  const baseName = `${original.name} (싱크 전 백업)`;
  let nameCandidate = baseName;
  let idx = 2;
  while (await prisma.productCategory.findUnique({ where: { name: nameCandidate } })) {
    nameCandidate = `${baseName} ${idx}`;
    idx += 1;
  }

  await prisma.productCategory.create({
    data: {
      name: nameCandidate,
      slug: await createUniqueCategorySlug(nameCandidate),
      sortOrder: original.sortOrder,
      isActive: false,
      isFreshnessManaged: original.isFreshnessManaged,
      freshnessSortOrder: original.freshnessSortOrder,
    },
  });
}

async function createProductBackup(productId: string): Promise<void> {
  const original = await prisma.menuProduct.findUnique({ where: { id: productId } });
  if (!original) return;

  const baseName = `${original.name} (싱크 전 백업)`;
  let nameCandidate = baseName;
  let idx = 2;
  while (
    await prisma.menuProduct.findFirst({
      where: {
        name: nameCandidate,
        loyverseId: null,
      },
      select: { id: true },
    })
  ) {
    nameCandidate = `${baseName} ${idx}`;
    idx += 1;
  }

  await prisma.menuProduct.create({
    data: {
      name: nameCandidate,
      sku: null,
      loyverseId: null,
      isActive: false,
      notes: original.notes,
      sellingPrice: original.sellingPrice,
      pricingTargetType: original.pricingTargetType,
      pricingTargetPercent: original.pricingTargetPercent,
      canBeUsedAsRecipeComponent: original.canBeUsedAsRecipeComponent,
      categoryId: original.categoryId,
      shelfLifeDays: original.shelfLifeDays,
      storageType: original.storageType,
      isProductionPlannable: original.isProductionPlannable,
      productionBatchSize: original.productionBatchSize,
      productionBufferPercent: original.productionBufferPercent,
      planningRoundingMode: original.planningRoundingMode,
      description: original.description,
      imageUrl: original.imageUrl,
      isPopular: original.isPopular,
      isSoldOut: original.isSoldOut,
    },
  });
}

async function syncCategories(
  categories: LoyverseCategory[],
  counters: SyncCounters
): Promise<Map<string, string>> {
  const categoryMap = new Map<string, string>();

  for (let i = 0; i < categories.length; i += 1) {
    const category = categories[i];

    const linked = await prisma.productCategory.findUnique({
      where: { loyverseId: category.id },
      select: { id: true },
    });

    if (linked) {
      await prisma.productCategory.update({
        where: { id: linked.id },
        data: {
          name: category.name,
          sortOrder: i,
          isActive: true,
        },
      });
      counters.categoriesUpdated += 1;
      categoryMap.set(category.id, linked.id);
      continue;
    }

    const nameMatch = await prisma.productCategory.findFirst({
      where: {
        loyverseId: null,
        name: { equals: category.name, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (nameMatch) {
      await createCategoryBackup(nameMatch.id);
      const updated = await prisma.productCategory.update({
        where: { id: nameMatch.id },
        data: {
          loyverseId: category.id,
          name: category.name,
          sortOrder: i,
          isActive: true,
        },
        select: { id: true },
      });
      counters.categoriesUpdated += 1;
      categoryMap.set(category.id, updated.id);
      continue;
    }

    const created = await prisma.productCategory.create({
      data: {
        loyverseId: category.id,
        name: category.name,
        slug: await createUniqueCategorySlug(category.name),
        sortOrder: i,
        isActive: true,
      },
      select: { id: true },
    });
    counters.categoriesAdded += 1;
    categoryMap.set(category.id, created.id);
  }

  return categoryMap;
}

async function syncModifierGroups(
  productId: string,
  groups: LoyverseModifierGroup[],
  counters: SyncCounters
): Promise<void> {
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex];

    const existingGroup = await prisma.menuModifierGroup.findUnique({
      where: { loyverseId: group.id },
      select: { id: true },
    });

    const groupRecord = existingGroup
      ? await prisma.menuModifierGroup.update({
          where: { id: existingGroup.id },
          data: {
            productId,
            name: group.name,
            isRequired: group.isRequired,
            minSelections: group.minSelections,
            maxSelections: group.maxSelections,
            sortOrder: groupIndex,
            isActive: true,
          },
          select: { id: true },
        })
      : await prisma.menuModifierGroup.create({
          data: {
            productId,
            loyverseId: group.id,
            name: group.name,
            isRequired: group.isRequired,
            minSelections: group.minSelections,
            maxSelections: group.maxSelections,
            sortOrder: groupIndex,
            isActive: true,
          },
          select: { id: true },
        });

    if (existingGroup) {
      counters.modifiersUpdated += 1;
    } else {
      counters.modifiersAdded += 1;
    }

    for (let optionIndex = 0; optionIndex < group.options.length; optionIndex += 1) {
      const option = group.options[optionIndex];

      const existingOption = await prisma.menuModifierOption.findUnique({
        where: { loyverseId: option.id },
        select: { id: true },
      });

      if (existingOption) {
        await prisma.menuModifierOption.update({
          where: { id: existingOption.id },
          data: {
            groupId: groupRecord.id,
            name: option.name,
            priceDelta: String(option.priceDelta),
            sortOrder: optionIndex,
            isActive: true,
          },
        });
        counters.modifiersUpdated += 1;
      } else {
        await prisma.menuModifierOption.create({
          data: {
            groupId: groupRecord.id,
            loyverseId: option.id,
            name: option.name,
            priceDelta: String(option.priceDelta),
            sortOrder: optionIndex,
            isActive: true,
          },
        });
        counters.modifiersAdded += 1;
      }
    }
  }
}

async function syncProducts(
  items: LoyverseItem[],
  categoryMap: Map<string, string>,
  counters: SyncCounters
): Promise<void> {
  for (const item of items) {
    const categoryId = item.categoryId ? (categoryMap.get(item.categoryId) ?? null) : null;

    const payload = {
      loyverseId: item.id,
      name: item.name,
      sku: item.sku,
      isActive: item.isActive,
      description: item.description,
      sellingPrice: item.sellingPrice !== null ? String(item.sellingPrice) : null,
      categoryId,
    };

    const byLoyverseId = await prisma.menuProduct.findUnique({
      where: { loyverseId: item.id },
      select: { id: true },
    });

    let productId: string;

    if (byLoyverseId) {
      const updated = await prisma.menuProduct.update({
        where: { id: byLoyverseId.id },
        data: payload,
        select: { id: true },
      });
      counters.productsUpdated += 1;
      productId = updated.id;
    } else {
      const orFilters: Array<Record<string, unknown>> = [
        { name: { equals: item.name, mode: "insensitive" } },
      ];
      if (item.sku) {
        orFilters.push({ sku: item.sku });
      }

      const byLocalMatch = await prisma.menuProduct.findFirst({
        where: {
          loyverseId: null,
          OR: orFilters,
        },
        select: { id: true },
      });

      if (byLocalMatch) {
        await createProductBackup(byLocalMatch.id);
        const updated = await prisma.menuProduct.update({
          where: { id: byLocalMatch.id },
          data: payload,
          select: { id: true },
        });
        counters.productsUpdated += 1;
        productId = updated.id;
      } else {
        const created = await prisma.menuProduct.create({
          data: payload,
          select: { id: true },
        });
        counters.productsAdded += 1;
        productId = created.id;
      }
    }

    if (item.modifierGroups.length > 0) {
      await syncModifierGroups(productId, item.modifierGroups, counters);
    }
  }
}

export async function syncLoyverseCatalog(
  triggeredByUserId?: string
): Promise<LoyverseSyncSummary> {
  const accessToken = process.env.LOYVERSE_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("LOYVERSE_ACCESS_TOKEN is not configured.");
  }

  const log = await prisma.loyverseSyncLog.create({
    data: {
      status: LoyverseSyncStatus.RUNNING,
      triggeredByUserId: triggeredByUserId ?? null,
    },
    select: { id: true },
  });

  const counters: SyncCounters = {
    categoriesAdded: 0,
    categoriesUpdated: 0,
    productsAdded: 0,
    productsUpdated: 0,
    modifiersAdded: 0,
    modifiersUpdated: 0,
  };

  const warnings: string[] = [];
  let categoriesFetched = 0;
  let productsFetched = 0;

  try {
    const categories = await loyverseGetCollection(
      "categories",
      "categories",
      toLoyverseCategory,
      accessToken
    );
    const items = await loyverseGetCollection("items", "items", toLoyverseItem, accessToken);

    categoriesFetched = categories.length;
    productsFetched = items.length;

    const categoryMap = await syncCategories(categories, counters);
    await syncProducts(items, categoryMap, counters);

    const status = warnings.length > 0 ? LoyverseSyncStatus.PARTIAL : LoyverseSyncStatus.SUCCESS;

    await prisma.loyverseSyncLog.update({
      where: { id: log.id },
      data: {
        status,
        finishedAt: new Date(),
        categoriesAdded: counters.categoriesAdded,
        categoriesUpdated: counters.categoriesUpdated,
        productsAdded: counters.productsAdded,
        productsUpdated: counters.productsUpdated,
        modifiersAdded: counters.modifiersAdded,
        modifiersUpdated: counters.modifiersUpdated,
        summaryJson: {
          categoriesFetched,
          productsFetched,
          warnings,
        },
      },
    });

    return {
      logId: log.id,
      status,
      categoriesFetched,
      productsFetched,
      warnings,
      ...counters,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Loyverse sync error";

    await prisma.loyverseSyncLog.update({
      where: { id: log.id },
      data: {
        status: LoyverseSyncStatus.FAILED,
        finishedAt: new Date(),
        categoriesAdded: counters.categoriesAdded,
        categoriesUpdated: counters.categoriesUpdated,
        productsAdded: counters.productsAdded,
        productsUpdated: counters.productsUpdated,
        modifiersAdded: counters.modifiersAdded,
        modifiersUpdated: counters.modifiersUpdated,
        errorMessage: message,
        summaryJson: {
          categoriesFetched,
          productsFetched,
          warnings,
        },
      },
    });

    throw error;
  }
}

export async function listLoyverseSyncLogs(limit = 20) {
  return prisma.loyverseSyncLog.findMany({
    orderBy: { startedAt: "desc" },
    take: Math.max(1, Math.min(limit, 100)),
    include: {
      triggeredByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}
