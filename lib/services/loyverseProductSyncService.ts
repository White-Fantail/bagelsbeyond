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
  imageUrl: string | null;
  categoryId: string | null;
  sellingPrice: number | null;
  isActive: boolean;
  modifierGroupIds: string[];
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

export type LoyverseItemMatchAction = "skip" | "match" | "create";

export type LoyverseSyncDecision = {
  action: LoyverseItemMatchAction;
  localProductId?: string;
};

export type LoyverseSyncDecisions = Record<string, LoyverseSyncDecision>;

type PreviewProductCandidate = {
  id: string;
  name: string;
  sku: string | null;
  isActive: boolean;
};

export type LoyverseItemMatchPreview = {
  loyverseItemId: string;
  loyverseItemName: string;
  loyverseSku: string | null;
  status: "matched" | "unmatched";
  matchedProduct: PreviewProductCandidate | null;
  candidateProducts: PreviewProductCandidate[];
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

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function pickFirstImageUrl(source: Record<string, unknown>): string | null {
  const directCandidates = ["image_url", "imageUrl", "image", "thumbnail_url", "thumbnailUrl"];
  for (const key of directCandidates) {
    const url = normalizeUrl(source[key]);
    if (url) return url;
  }

  const imageObjectCandidates = ["image_data", "imageData", "thumbnail", "main_image"];
  for (const key of imageObjectCandidates) {
    const value = source[key];
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    const nestedCandidates = ["url", "image_url", "imageUrl", "src"];
    for (const nestedKey of nestedCandidates) {
      const url = normalizeUrl(row[nestedKey]);
      if (url) return url;
    }
  }

  const imageArrayCandidates = ["images", "photos"];
  for (const key of imageArrayCandidates) {
    const value = source[key];
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const url = normalizeUrl(row.url ?? row.image_url ?? row.imageUrl ?? row.src);
      if (url) return url;
    }
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

function toLoyverseModifierGroup(raw: unknown): LoyverseModifierGroup | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
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
  const isRequired = Boolean(row.required ?? row.is_required) || minSelections > 0;

  return {
    id,
    name,
    isRequired,
    minSelections,
    maxSelections: maxSelections > 0 ? maxSelections : 1,
    options,
  };
}

function extractModifierGroups(raw: unknown): LoyverseModifierGroup[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((groupRaw) => toLoyverseModifierGroup(groupRaw))
    .filter((row): row is LoyverseModifierGroup => row !== null);
}

function extractModifierGroupIds(source: Record<string, unknown>): string[] {
  const values: unknown[] = [];

  const arrayCandidates = [
    source.modifier_list_ids,
    source.modifier_lists_ids,
    source.modifier_group_ids,
    source.option_group_ids,
  ];
  for (const candidate of arrayCandidates) {
    if (Array.isArray(candidate)) {
      values.push(...candidate);
    }
  }

  const singleCandidates = [source.modifier_list_id, source.modifier_group_id];
  values.push(...singleCandidates);

  const ids = values
    .map((value) => {
      if (typeof value === "string") return normalizeString(value);
      if (!value || typeof value !== "object") return "";
      const row = value as Record<string, unknown>;
      return (
        normalizeString(row.id) ||
        normalizeString(row.modifier_list_id) ||
        normalizeString(row.group_id)
      );
    })
    .filter((value) => value.length > 0);

  return Array.from(new Set(ids));
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
  const modifierGroupIds = extractModifierGroupIds(row);

  return {
    id,
    name,
    sku: normalizeOptionalString(row.sku),
    description: normalizeOptionalString(row.description),
    imageUrl: pickFirstImageUrl(row),
    categoryId: normalizeOptionalString(row.category_id),
    sellingPrice: pickFirstPrice(row) ?? variantPrice,
    isActive: !Boolean(row.deleted_at ?? row.is_deleted),
    modifierGroupIds:
      modifierGroupIds.length > 0 ? modifierGroupIds : modifierGroups.map((group) => group.id),
    modifierGroups,
  };
}

function hydrateItemsWithModifierGroups(
  items: LoyverseItem[],
  modifierGroups: LoyverseModifierGroup[]
): LoyverseItem[] {
  if (modifierGroups.length === 0) return items;

  const groupsById = new Map(modifierGroups.map((group) => [group.id, group]));

  return items.map((item) => {
    if (item.modifierGroups.length > 0 || item.modifierGroupIds.length === 0) {
      return item;
    }

    const resolvedGroups = item.modifierGroupIds
      .map((groupId) => groupsById.get(groupId))
      .filter((group): group is LoyverseModifierGroup => group !== undefined);

    if (resolvedGroups.length === 0) return item;

    return {
      ...item,
      modifierGroups: resolvedGroups,
    };
  });
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
        Authorization: ["Bearer", accessToken].join(" "),
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

async function fetchLoyverseModifierGroups(accessToken: string): Promise<LoyverseModifierGroup[]> {
  const attempts = [
    { path: "modifier_lists", collectionKey: "modifier_lists" },
    { path: "modifiers", collectionKey: "modifiers" },
  ] as const;

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    try {
      return await loyverseGetCollection(
        attempt.path,
        attempt.collectionKey,
        toLoyverseModifierGroup,
        accessToken
      );
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(`Unknown modifier fetch error for ${attempt.path}`);
    }
  }

  throw lastError ?? new Error("Failed to fetch Loyverse modifiers");
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
  const incomingLoyverseIds = new Set(categories.map((c) => c.id));

  // Deactivate local categories linked to Loyverse IDs that no longer exist
  const localLinked = await prisma.productCategory.findMany({
    where: { loyverseId: { not: null }, isActive: true },
    select: { id: true, loyverseId: true },
  });
  for (const local of localLinked) {
    if (local.loyverseId && !incomingLoyverseIds.has(local.loyverseId)) {
      await prisma.productCategory.update({
        where: { id: local.id },
        data: { isActive: false },
      });
      counters.categoriesUpdated += 1;
    }
  }

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
  const incomingGroupLoyverseIds = new Set(groups.map((g) => g.id));

  // Deactivate groups that exist locally but are no longer in Loyverse
  const localGroups = await prisma.menuModifierGroup.findMany({
    where: { productId, loyverseId: { not: null }, isActive: true },
    select: { id: true, loyverseId: true },
  });
  for (const local of localGroups) {
    if (local.loyverseId && !incomingGroupLoyverseIds.has(local.loyverseId)) {
      await prisma.menuModifierGroup.update({
        where: { id: local.id },
        data: { isActive: false },
      });
      counters.modifiersUpdated += 1;
    }
  }

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex];

    const existingGroup = await prisma.menuModifierGroup.findFirst({
      where: { productId, loyverseId: group.id },
      select: { id: true },
    });

    const groupRecord = existingGroup
      ? await prisma.menuModifierGroup.update({
          where: { id: existingGroup.id },
          data: {
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

    const incomingOptionLoyverseIds = new Set(group.options.map((o) => o.id));

    // Deactivate options that are no longer in Loyverse
    const localOptions = await prisma.menuModifierOption.findMany({
      where: { groupId: groupRecord.id, loyverseId: { not: null }, isActive: true },
      select: { id: true, loyverseId: true },
    });
    for (const local of localOptions) {
      if (local.loyverseId && !incomingOptionLoyverseIds.has(local.loyverseId)) {
        await prisma.menuModifierOption.update({
          where: { id: local.id },
          data: { isActive: false },
        });
        counters.modifiersUpdated += 1;
      }
    }

    for (let optionIndex = 0; optionIndex < group.options.length; optionIndex += 1) {
      const option = group.options[optionIndex];

      const existingOption = await prisma.menuModifierOption.findFirst({
        where: { groupId: groupRecord.id, loyverseId: option.id },
        select: { id: true },
      });

      if (existingOption) {
        await prisma.menuModifierOption.update({
          where: { id: existingOption.id },
          data: {
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
  counters: SyncCounters,
  warnings: string[],
  decisions: LoyverseSyncDecisions
): Promise<void> {
  for (const item of items) {
    const categoryId = item.categoryId ? (categoryMap.get(item.categoryId) ?? null) : null;

    const payload = {
      loyverseId: item.id,
      name: item.name,
      sku: item.sku,
      isActive: item.isActive,
      description: item.description,
      imageUrl: item.imageUrl,
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
      const decision = decisions[item.id];
      if (decision?.action === "skip") {
        warnings.push(`Skipped unmatched Loyverse item: ${item.name} (${item.id})`);
        continue;
      }

      if (decision?.action === "match" && decision.localProductId) {
        const explicitMatch = await prisma.menuProduct.findUnique({
          where: { id: decision.localProductId },
          select: { id: true, loyverseId: true },
        });
        if (explicitMatch && explicitMatch.loyverseId === null) {
          await createProductBackup(explicitMatch.id);
          const updated = await prisma.menuProduct.update({
            where: { id: explicitMatch.id },
            data: payload,
            select: { id: true },
          });
          counters.productsUpdated += 1;
          productId = updated.id;

          if (item.modifierGroups.length > 0) {
            await syncModifierGroups(productId, item.modifierGroups, counters);
          }
          continue;
        }
        warnings.push(
          `Invalid explicit match ignored for item ${item.id}: local product not found or already linked`
        );
      }

      if (decision?.action === "create") {
        const created = await prisma.menuProduct.create({
          data: payload,
          select: { id: true },
        });
        counters.productsAdded += 1;
        productId = created.id;

        if (item.modifierGroups.length > 0) {
          await syncModifierGroups(productId, item.modifierGroups, counters);
        }
        continue;
      }

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
  triggeredByUserId?: string,
  decisions: LoyverseSyncDecisions = {}
): Promise<LoyverseSyncSummary> {
  const accessToken = process.env.LOYVERSE_API_TOKEN;
  if (!accessToken) {
    throw new Error("LOYVERSE_API_TOKEN is not configured.");
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
    const [categories, rawItems, modifierGroups] = await Promise.all([
      loyverseGetCollection("categories", "categories", toLoyverseCategory, accessToken),
      loyverseGetCollection("items", "items", toLoyverseItem, accessToken),
      fetchLoyverseModifierGroups(accessToken),
    ]);
    const items = hydrateItemsWithModifierGroups(rawItems, modifierGroups);

    categoriesFetched = categories.length;
    productsFetched = items.length;

    const categoryMap = await syncCategories(categories, counters);
    await syncProducts(items, categoryMap, counters, warnings, decisions);

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

export async function previewLoyverseItemMatches(): Promise<LoyverseItemMatchPreview[]> {
  const accessToken = process.env.LOYVERSE_API_TOKEN;
  if (!accessToken) {
    throw new Error("LOYVERSE_API_TOKEN is not configured.");
  }

  const items = await loyverseGetCollection("items", "items", toLoyverseItem, accessToken);
  const previews: LoyverseItemMatchPreview[] = [];

  for (const item of items) {
    const matched = await prisma.menuProduct.findUnique({
      where: { loyverseId: item.id },
      select: { id: true, name: true, sku: true, isActive: true },
    });

    if (matched) {
      previews.push({
        loyverseItemId: item.id,
        loyverseItemName: item.name,
        loyverseSku: item.sku,
        status: "matched",
        matchedProduct: matched,
        candidateProducts: [],
      });
      continue;
    }

    const candidateWhere: Record<string, unknown>[] = [
      { name: { equals: item.name, mode: "insensitive" } },
    ];
    if (item.sku) {
      candidateWhere.push({ sku: item.sku });
    }

    const candidates = await prisma.menuProduct.findMany({
      where: {
        loyverseId: null,
        OR: candidateWhere,
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, isActive: true },
      take: 10,
    });

    previews.push({
      loyverseItemId: item.id,
      loyverseItemName: item.name,
      loyverseSku: item.sku,
      status: "unmatched",
      matchedProduct: null,
      candidateProducts: candidates,
    });
  }

  return previews;
}

// ─── Catalog Preview (categories + modifiers) ─────────────────────────────────

export type CategoryPreviewStatus =
  | "linked_match"   // loyverseId linked, name unchanged
  | "linked_changed" // loyverseId linked, name will change
  | "name_match"     // no loyverseId but name matches → will auto-link
  | "new"            // will be created
  | "local_only";    // linked locally but deleted from Loyverse → will deactivate

export type CategoryPreviewItem = {
  loyverseId: string | null;
  loyverseName: string | null;
  localId: string | null;
  localName: string | null;
  status: CategoryPreviewStatus;
};

export type ModifierOptionPreviewStatus = "unchanged" | "changed" | "new" | "removed";

export type ModifierOptionPreview = {
  loyverseId: string | null;
  localId: string | null;
  name: string;
  newName: string | null;
  priceDelta: number;
  newPriceDelta: number | null;
  status: ModifierOptionPreviewStatus;
};

export type ModifierGroupPreviewStatus = "unchanged" | "changed" | "new" | "removed";

export type ModifierGroupPreview = {
  loyverseId: string | null;
  localId: string | null;
  name: string;
  newName: string | null;
  status: ModifierGroupPreviewStatus;
  options: ModifierOptionPreview[];
};

export type ProductModifierPreview = {
  productId: string;
  productName: string;
  groups: ModifierGroupPreview[];
};

export type LoyverseCatalogPreview = {
  categories: CategoryPreviewItem[];
  modifiers: ProductModifierPreview[];
};

export async function previewLoyverseCatalog(): Promise<LoyverseCatalogPreview> {
  const accessToken = process.env.LOYVERSE_API_TOKEN;
  if (!accessToken) {
    throw new Error("LOYVERSE_API_TOKEN is not configured.");
  }

  type LocalModOption = { id: string; loyverseId: string | null; name: string; priceDelta: { toNumber(): number } | number };

  const [loyverseCategories, rawLoyverseItems, modifierGroups] = await Promise.all([
    loyverseGetCollection("categories", "categories", toLoyverseCategory, accessToken),
    loyverseGetCollection("items", "items", toLoyverseItem, accessToken),
    fetchLoyverseModifierGroups(accessToken),
  ]);
  const loyverseItems = hydrateItemsWithModifierGroups(rawLoyverseItems, modifierGroups);

  // ── Category preview ──────────────────────────────────────────────────────

  const categoryPreviews: CategoryPreviewItem[] = [];
  const seenLocalIds = new Set<string>();

  // Fetch all local categories upfront to avoid N+1 queries
  const allLocalCategories = await prisma.productCategory.findMany({
    select: { id: true, name: true, loyverseId: true, isActive: true },
  });
  const localCatByLoyverseId = new Map(
    allLocalCategories.filter((c) => c.loyverseId).map((c) => [c.loyverseId!, c])
  );
  const localCatByNameLower = new Map(
    allLocalCategories.filter((c) => !c.loyverseId).map((c) => [c.name.toLowerCase(), c])
  );

  for (const cat of loyverseCategories) {
    const linked = localCatByLoyverseId.get(cat.id);

    if (linked) {
      seenLocalIds.add(linked.id);
      categoryPreviews.push({
        loyverseId: cat.id,
        loyverseName: cat.name,
        localId: linked.id,
        localName: linked.name,
        status: linked.name === cat.name ? "linked_match" : "linked_changed",
      });
      continue;
    }

    const nameMatch = localCatByNameLower.get(cat.name.toLowerCase());

    if (nameMatch) {
      seenLocalIds.add(nameMatch.id);
      categoryPreviews.push({
        loyverseId: cat.id,
        loyverseName: cat.name,
        localId: nameMatch.id,
        localName: nameMatch.name,
        status: "name_match",
      });
    } else {
      categoryPreviews.push({
        loyverseId: cat.id,
        loyverseName: cat.name,
        localId: null,
        localName: null,
        status: "new",
      });
    }
  }

  // Find local-only categories (linked but not in Loyverse anymore)
  for (const local of allLocalCategories) {
    if (local.loyverseId && local.isActive && !seenLocalIds.has(local.id)) {
      categoryPreviews.push({
        loyverseId: local.loyverseId,
        loyverseName: null,
        localId: local.id,
        localName: local.name,
        status: "local_only",
      });
    }
  }

  // ── Modifier preview ──────────────────────────────────────────────────────

  const modifierPreviews: ProductModifierPreview[] = [];

  // Fetch all linked products and their modifier groups upfront
  const itemsWithModifiers = loyverseItems.filter((i) => i.modifierGroups.length > 0);
  const loyverseItemIds = itemsWithModifiers.map((i) => i.id);

  const linkedProducts = await prisma.menuProduct.findMany({
    where: { loyverseId: { in: loyverseItemIds } },
    select: { id: true, name: true, loyverseId: true },
  });
  const localProductByLoyverseId = new Map(linkedProducts.map((p) => [p.loyverseId!, p]));

  const linkedProductIds = linkedProducts.map((p) => p.id);
  const allLocalGroups = await prisma.menuModifierGroup.findMany({
    where: { productId: { in: linkedProductIds } },
    select: {
      id: true,
      productId: true,
      loyverseId: true,
      name: true,
      isActive: true,
      options: { select: { id: true, loyverseId: true, name: true, priceDelta: true } },
    },
  });
  // Index: productId → loyverseId → group
  const groupsByProduct = new Map<string, Map<string, (typeof allLocalGroups)[0]>>();
  const allGroupsByProduct = new Map<string, (typeof allLocalGroups)[0][]>();
  for (const g of allLocalGroups) {
    if (!allGroupsByProduct.has(g.productId)) allGroupsByProduct.set(g.productId, []);
    allGroupsByProduct.get(g.productId)!.push(g);
    if (g.loyverseId) {
      if (!groupsByProduct.has(g.productId)) groupsByProduct.set(g.productId, new Map());
      groupsByProduct.get(g.productId)!.set(g.loyverseId, g);
    }
  }

  for (const item of itemsWithModifiers) {
    const localProduct = localProductByLoyverseId.get(item.id);
    if (!localProduct) continue;

    const groupPreviews: ModifierGroupPreview[] = [];
    const seenGroupLocalIds = new Set<string>();
    const groupMap = groupsByProduct.get(localProduct.id) ?? new Map();

    for (const group of item.modifierGroups) {
      const existingGroup = groupMap.get(group.id);

      const optionPreviews: ModifierOptionPreview[] = [];
      const seenOptionLocalIds = new Set<string>();

      if (existingGroup) {
        seenGroupLocalIds.add(existingGroup.id);

        for (const option of group.options) {
          const existingOption = (existingGroup.options as LocalModOption[]).find(
            (o) => o.loyverseId === option.id
          );
          if (existingOption) {
            seenOptionLocalIds.add(existingOption.id);
            const nameChanged = existingOption.name !== option.name;
            const priceChanged = Number(existingOption.priceDelta) !== option.priceDelta;
            optionPreviews.push({
              loyverseId: option.id,
              localId: existingOption.id,
              name: existingOption.name,
              newName: nameChanged ? option.name : null,
              priceDelta: Number(existingOption.priceDelta),
              newPriceDelta: priceChanged ? option.priceDelta : null,
              status: nameChanged || priceChanged ? "changed" : "unchanged",
            });
          } else {
            optionPreviews.push({
              loyverseId: option.id,
              localId: null,
              name: option.name,
              newName: null,
              priceDelta: option.priceDelta,
              newPriceDelta: null,
              status: "new",
            });
          }
        }

        // Options removed from Loyverse
        for (const localOpt of existingGroup.options as LocalModOption[]) {
          if (localOpt.loyverseId && !seenOptionLocalIds.has(localOpt.id)) {
            optionPreviews.push({
              loyverseId: localOpt.loyverseId,
              localId: localOpt.id,
              name: localOpt.name,
              newName: null,
              priceDelta: Number(localOpt.priceDelta),
              newPriceDelta: null,
              status: "removed",
            });
          }
        }

        const nameChanged = existingGroup.name !== group.name;
        const hasChanges = nameChanged || optionPreviews.some((o) => o.status !== "unchanged");
        groupPreviews.push({
          loyverseId: group.id,
          localId: existingGroup.id,
          name: existingGroup.name,
          newName: nameChanged ? group.name : null,
          status: hasChanges ? "changed" : "unchanged",
          options: optionPreviews,
        });
      } else {
        for (const option of group.options) {
          optionPreviews.push({
            loyverseId: option.id,
            localId: null,
            name: option.name,
            newName: null,
            priceDelta: option.priceDelta,
            newPriceDelta: null,
            status: "new",
          });
        }
        groupPreviews.push({
          loyverseId: group.id,
          localId: null,
          name: group.name,
          newName: null,
          status: "new",
          options: optionPreviews,
        });
      }
    }

    // Modifier groups removed from Loyverse
    for (const local of allGroupsByProduct.get(localProduct.id) ?? []) {
      if (local.loyverseId && local.isActive && !seenGroupLocalIds.has(local.id)) {
        groupPreviews.push({
          loyverseId: local.loyverseId,
          localId: local.id,
          name: local.name,
          newName: null,
          status: "removed",
          options: local.options.map((o) => ({
            loyverseId: o.loyverseId,
            localId: o.id,
            name: o.name,
            newName: null,
            priceDelta: Number(o.priceDelta),
            newPriceDelta: null,
            status: "removed" as ModifierOptionPreviewStatus,
          })),
        });
      }
    }

    if (groupPreviews.length > 0) {
      modifierPreviews.push({
        productId: localProduct.id,
        productName: localProduct.name,
        groups: groupPreviews,
      });
    }
  }

  return { categories: categoryPreviews, modifiers: modifierPreviews };
}
