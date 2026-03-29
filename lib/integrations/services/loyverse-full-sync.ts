// ─── Loyverse Full Sync Service ───────────────────────────────────────────────
// Unified orchestration service that syncs all Loyverse data in a single pass:
//   1. Categories  → LoyverseCategory upsert
//   2. Modifier groups + options  → ProductOptionGroup / ProductOption upsert
//   3. Products  → Product upsert + category link + modifier group assignments
//   4. Stale link cleanup
//
// This replaces the previous split approach of running product-sync and
// modifier-sync separately, which caused Product ↔ ModifierGroup connections
// to be missing when modifier-sync ran before the product was in the DB.
//
// Usage:
//   const adapter = createLoyverseAdapter();
//   const result = await runLoyverseFullSync(adapter);
//
// Design notes:
//   • Loyverse is the single source of truth.
//   • Local DB mirrors Loyverse data; no local-only categories.
//   • Each step is logged; the summary shows exactly how many rows were touched.
//   • product-modifier links that no longer exist in Loyverse are removed.

import { prisma } from "@/lib/db";
import type { LoyverseAdapter } from "../adapters/pos/loyverse";
import type {
  LoyverseRawCategory,
  LoyverseRawModifier,
  LoyverseRawItem,
} from "../adapters/pos/types";
import { IntegrationSource } from "@/app/generated/prisma/enums";

// ─── Result types ─────────────────────────────────────────────────────────────

export interface FullSyncResult {
  status: "success" | "partial" | "failed";
  startedAt: Date;
  finishedAt?: Date;
  // Fetch counts
  categoriesFetched: number;
  productsFetched: number;
  modifierGroupsFetched: number;
  modifierOptionsFetched: number;
  // Upsert counts
  categoriesUpserted: number;
  productsCreated: number;
  productsUpdated: number;
  modifierGroupsUpserted: number;
  modifierOptionsUpserted: number;
  // Link counts
  categoryLinksUpdated: number;
  modifierLinksUpdated: number;
  staleLinksRemoved: number;
  // Error tracking
  skippedCount: number;
  errorCount: number;
  errors: string[];
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Run a full Loyverse sync: categories → modifier groups → products → links.
 * Returns a detailed summary of everything that was touched.
 */
export async function runLoyverseFullSync(adapter: LoyverseAdapter): Promise<FullSyncResult> {
  const result: FullSyncResult = {
    status: "success",
    startedAt: new Date(),
    categoriesFetched: 0,
    productsFetched: 0,
    modifierGroupsFetched: 0,
    modifierOptionsFetched: 0,
    categoriesUpserted: 0,
    productsCreated: 0,
    productsUpdated: 0,
    modifierGroupsUpserted: 0,
    modifierOptionsUpserted: 0,
    categoryLinksUpdated: 0,
    modifierLinksUpdated: 0,
    staleLinksRemoved: 0,
    skippedCount: 0,
    errorCount: 0,
    errors: [],
  };

  try {
    // ── Step 1: Fetch everything from Loyverse ─────────────────────────────────
    console.info("[full-sync] Fetching Loyverse catalog...");
    const raw = await adapter.fetchCatalog();

    const activeCategories = raw.categories.filter((c) => c.deleted_at === null);
    const activeModifiers = raw.modifiers.filter((m) => m.deleted_at === null);
    const activeItems = raw.items.filter((item) => item.deleted_at === null);

    result.categoriesFetched = activeCategories.length;
    result.modifierGroupsFetched = activeModifiers.length;
    result.modifierOptionsFetched = activeModifiers.reduce(
      (s, m) => s + (m.options?.length ?? 0),
      0
    );
    result.productsFetched = activeItems.length;

    console.info(
      `[full-sync] Fetched: categories=${result.categoriesFetched} ` +
      `modifiers=${result.modifierGroupsFetched} items=${result.productsFetched}`
    );

    // ── Step 2: Upsert categories ──────────────────────────────────────────────
    const categoryIdMap = await syncCategories(activeCategories, result);
    console.info(`[full-sync] Categories upserted: ${result.categoriesUpserted}`);

    // ── Step 3: Upsert modifier groups + options ───────────────────────────────
    const modifierGroupIdMap = await syncModifierGroups(activeModifiers, result);
    console.info(`[full-sync] Modifier groups upserted: ${result.modifierGroupsUpserted}`);

    // ── Step 4: Upsert products + links ───────────────────────────────────────
    await syncProducts(activeItems, categoryIdMap, modifierGroupIdMap, result);
    console.info(
      `[full-sync] Products: created=${result.productsCreated} updated=${result.productsUpdated}`
    );

    // ── Step 5: Clean up stale modifier links ──────────────────────────────────
    await removeStaleModifierLinks(activeItems, result);
    console.info(`[full-sync] Stale links removed: ${result.staleLinksRemoved}`);

    result.status = result.errorCount > 0 ? "partial" : "success";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[full-sync] Fatal error:", message);
    result.errors.push(message);
    result.errorCount++;
    result.status = "failed";
  }

  result.finishedAt = new Date();

  // Persist the sync log
  try {
    await prisma.loyverseFullSyncLog.create({
      data: {
        status: result.status,
        categoriesFetched: result.categoriesFetched,
        categoriesUpserted: result.categoriesUpserted,
        productsFetched: result.productsFetched,
        productsCreated: result.productsCreated,
        productsUpdated: result.productsUpdated,
        modifierGroupsFetched: result.modifierGroupsFetched,
        modifierGroupsUpserted: result.modifierGroupsUpserted,
        modifierOptionsFetched: result.modifierOptionsFetched,
        modifierOptionsUpserted: result.modifierOptionsUpserted,
        categoryLinksUpdated: result.categoryLinksUpdated,
        modifierLinksUpdated: result.modifierLinksUpdated,
        staleLinksRemoved: result.staleLinksRemoved,
        skippedCount: result.skippedCount,
        errorCount: result.errorCount,
        errorMessage: result.errors.length > 0 ? result.errors.slice(0, 3).join("; ") : null,
      },
    });
  } catch (logErr) {
    console.error("[full-sync] Failed to persist sync log:", logErr);
  }

  const duration = ((result.finishedAt.getTime() - result.startedAt.getTime()) / 1000).toFixed(1);
  console.info(
    `[full-sync] DONE status=${result.status} duration=${duration}s ` +
    `categories=${result.categoriesUpserted} products_created=${result.productsCreated} ` +
    `products_updated=${result.productsUpdated} modifier_groups=${result.modifierGroupsUpserted} ` +
    `modifier_options=${result.modifierOptionsUpserted} ` +
    `category_links=${result.categoryLinksUpdated} modifier_links=${result.modifierLinksUpdated} ` +
    `stale_removed=${result.staleLinksRemoved} errors=${result.errorCount}`
  );

  return result;
}

// ─── Step 2: Category sync ────────────────────────────────────────────────────

/**
 * Upsert all active Loyverse categories into LoyverseCategory.
 * Returns a map of Loyverse category ID → { internalId, name }.
 */
async function syncCategories(
  categories: LoyverseRawCategory[],
  result: FullSyncResult
): Promise<Map<string, { id: string; name: string }>> {
  const idMap = new Map<string, { id: string; name: string }>();

  for (const cat of categories) {
    try {
      const upserted = await prisma.loyverseCategory.upsert({
        where: { loyverseCategoryId: cat.id },
        create: {
          loyverseCategoryId: cat.id,
          name: cat.name,
          color: cat.color,
          isActive: true,
          rawPayload: cat as object,
        },
        update: {
          name: cat.name,
          color: cat.color,
          isActive: true,
          rawPayload: cat as object,
          updatedAt: new Date(),
          // isVisible and displayOrder are intentionally NOT updated here —
          // they are managed by the admin and must survive re-syncs.
        },
      });
      idMap.set(cat.id, { id: upserted.id, name: cat.name });
      result.categoriesUpserted++;
    } catch (err) {
      const msg = `Category "${cat.name}" (${cat.id}): ${String(err)}`;
      result.errors.push(msg);
      result.errorCount++;
      console.error("[full-sync] Category upsert error:", msg);
    }
  }

  // Mark categories no longer in Loyverse as inactive
  try {
    const loyverseIds = categories.map((c) => c.id);
    const { count } = await prisma.loyverseCategory.updateMany({
      where: {
        loyverseCategoryId: { notIn: loyverseIds },
        isActive: true,
      },
      data: { isActive: false, updatedAt: new Date() },
    });
    if (count > 0) {
      console.info(`[full-sync] Deactivated ${count} stale categories`);
    }
  } catch (err) {
    console.error("[full-sync] Failed to deactivate stale categories:", err);
  }

  return idMap;
}

// ─── Step 3: Modifier group + option sync ─────────────────────────────────────

/**
 * Upsert all active Loyverse modifier groups and their options.
 * Returns a map of Loyverse modifier group ID → internal ProductOptionGroup id.
 */
async function syncModifierGroups(
  modifiers: LoyverseRawModifier[],
  result: FullSyncResult
): Promise<Map<string, string>> {
  const idMap = new Map<string, string>();

  for (const rawGroup of modifiers) {
    try {
      // ── Find or create the internal option group ───────────────────────────
      const existingMap = await prisma.externalOptionGroupMap.findUnique({
        where: {
          source_externalOptionGroupId: {
            source: IntegrationSource.LOYVERSE,
            externalOptionGroupId: rawGroup.id,
          },
        },
        include: { optionGroup: { include: { options: true } } },
      });

      let optionGroupId: string;
      let existingOptions: Array<{ id: string; name: string }> = [];

      if (existingMap) {
        // Update the group name
        await prisma.productOptionGroup.update({
          where: { id: existingMap.optionGroupId },
          data: { name: rawGroup.name, updatedAt: new Date() },
        });
        await prisma.externalOptionGroupMap.update({
          where: { id: existingMap.id },
          data: { lastSyncedAt: new Date() },
        });
        optionGroupId = existingMap.optionGroupId;
        existingOptions = existingMap.optionGroup.options;
      } else {
        // Check for orphan by name (migration compatibility)
        const orphan = await prisma.productOptionGroup.findFirst({
          where: { name: rawGroup.name },
          include: { options: true },
        });

        if (orphan) {
          await prisma.externalOptionGroupMap.create({
            data: {
              source: IntegrationSource.LOYVERSE,
              externalOptionGroupId: rawGroup.id,
              optionGroupId: orphan.id,
              lastSyncedAt: new Date(),
            },
          });
          optionGroupId = orphan.id;
          existingOptions = orphan.options;
        } else {
          const newGroup = await prisma.productOptionGroup.create({
            data: {
              productId: null,
              name: rawGroup.name,
              minSelect: 0,
              maxSelect: 1,
              isRequired: false,
            },
          });
          await prisma.externalOptionGroupMap.create({
            data: {
              source: IntegrationSource.LOYVERSE,
              externalOptionGroupId: rawGroup.id,
              optionGroupId: newGroup.id,
              lastSyncedAt: new Date(),
            },
          });
          optionGroupId = newGroup.id;
        }
      }

      idMap.set(rawGroup.id, optionGroupId);
      result.modifierGroupsUpserted++;

      // ── Upsert options ───────────────────────────────────────────────────────
      const optionCount = await upsertModifierOptions(
        optionGroupId,
        rawGroup,
        existingOptions
      );
      result.modifierOptionsUpserted += optionCount;
    } catch (err) {
      const msg = `ModifierGroup "${rawGroup.name}" (${rawGroup.id}): ${String(err)}`;
      result.errors.push(msg);
      result.errorCount++;
      console.error("[full-sync] ModifierGroup upsert error:", msg);
    }
  }

  return idMap;
}

/**
 * Upsert options for a single modifier group.
 * Returns the number of options upserted.
 */
async function upsertModifierOptions(
  optionGroupId: string,
  rawGroup: LoyverseRawModifier,
  existingOptions: Array<{ id: string; name: string }>
): Promise<number> {
  const existingByName = new Map(existingOptions.map((o) => [o.name, o]));
  let count = 0;

  for (const rawOpt of rawGroup.options ?? []) {
    try {
      let optionId: string;
      const existing = existingByName.get(rawOpt.name);

      if (existing) {
        await prisma.productOption.update({
          where: { id: existing.id },
          data: { priceDelta: rawOpt.price, isActive: true },
        });
        optionId = existing.id;
      } else {
        const created = await prisma.productOption.create({
          data: {
            optionGroupId,
            name: rawOpt.name,
            priceDelta: rawOpt.price,
            isActive: true,
          },
        });
        optionId = created.id;
      }

      // Upsert ExternalOptionMap (idempotent)
      await prisma.externalOptionMap.upsert({
        where: {
          source_externalOptionId: {
            source: IntegrationSource.LOYVERSE,
            externalOptionId: rawOpt.id,
          },
        },
        create: {
          source: IntegrationSource.LOYVERSE,
          productOptionId: optionId,
          externalOptionId: rawOpt.id,
          externalName: rawOpt.name,
          externalGroupId: rawGroup.id,
          externalGroupName: rawGroup.name,
          lastSyncedAt: new Date(),
        },
        update: {
          productOptionId: optionId,
          externalName: rawOpt.name,
          externalGroupId: rawGroup.id,
          externalGroupName: rawGroup.name,
          lastSyncedAt: new Date(),
        },
      });

      count++;
    } catch (err) {
      console.error(
        `[full-sync] Option "${rawOpt.name}" in group "${rawGroup.name}": ${String(err)}`
      );
    }
  }

  return count;
}

// ─── Step 4: Product sync + links ─────────────────────────────────────────────

/**
 * Upsert all active Loyverse items as internal Products.
 * Also links each product to its Loyverse category and modifier groups.
 */
async function syncProducts(
  items: LoyverseRawItem[],
  categoryIdMap: Map<string, { id: string; name: string }>,
  modifierGroupIdMap: Map<string, string>,
  result: FullSyncResult
): Promise<void> {
  for (const item of items) {
    try {
      // Resolve Loyverse category → internal LoyverseCategory id and name
      const categoryEntry = item.category_id ? categoryIdMap.get(item.category_id) : undefined;
      const loyverseCategoryId = categoryEntry?.id ?? null;

      // Resolve price and active status
      const basePrice = resolveItemPrice(item);
      const isActive =
        item.variants.some((v) => v.stores.some((s) => s.available_for_sale));

      // Determine fields to write
      const productFields = {
        name: item.item_name,
        description: item.description ?? null,
        basePrice,
        isActive,
        loyverseCategoryId,
        updatedAt: new Date(),
      };

      // Check for existing product via ExternalProductMap
      const existingMap = await prisma.externalProductMap.findUnique({
        where: {
          source_externalProductId: {
            source: IntegrationSource.LOYVERSE,
            externalProductId: item.id,
          },
        },
      });

      let productId: string;

      if (existingMap) {
        // UPDATE path
        await prisma.product.update({
          where: { id: existingMap.productId },
          data: productFields,
        });
        await prisma.externalProductMap.update({
          where: { id: existingMap.id },
          data: { externalName: item.item_name, lastSyncedAt: new Date() },
        });
        productId = existingMap.productId;
        result.productsUpdated++;
      } else {
        // CREATE path
        const slug = await ensureUniqueSlug(slugify(item.item_name));
        const product = await prisma.product.create({
          data: {
            ...productFields,
            slug,
          },
        });
        await prisma.externalProductMap.create({
          data: {
            source: IntegrationSource.LOYVERSE,
            externalProductId: item.id,
            productId: product.id,
            externalName: item.item_name,
            lastSyncedAt: new Date(),
          },
        });
        productId = product.id;
        result.productsCreated++;
      }

      // Track category link
      if (loyverseCategoryId) {
        result.categoryLinksUpdated++;
      }

      // Link product to modifier groups via ProductOptionGroupAssignment
      for (const modifierId of item.modifier_ids ?? []) {
        const optionGroupId = modifierGroupIdMap.get(modifierId);
        if (!optionGroupId) {
          console.warn(
            `[full-sync] Product "${item.item_name}": modifier group ${modifierId} not found in DB — skipping link`
          );
          result.skippedCount++;
          continue;
        }

        try {
          await prisma.productOptionGroupAssignment.upsert({
            where: {
              productId_optionGroupId: { productId, optionGroupId },
            },
            create: { productId, optionGroupId },
            update: {},
          });
          result.modifierLinksUpdated++;
        } catch (err) {
          console.error(
            `[full-sync] Failed to link product "${item.item_name}" → modifier ${modifierId}: ${String(err)}`
          );
        }
      }
    } catch (err) {
      const msg = `Product "${item.item_name}" (${item.id}): ${String(err)}`;
      result.errors.push(msg);
      result.errorCount++;
      console.error("[full-sync] Product upsert error:", msg);
    }
  }
}

// ─── Step 5: Remove stale modifier links ──────────────────────────────────────

/**
 * Remove ProductOptionGroupAssignment rows for Loyverse-synced products
 * where the modifier group is no longer connected in Loyverse.
 *
 * Only removes links where both the product AND the option group have
 * ExternalProductMap / ExternalOptionGroupMap entries (i.e., they are
 * Loyverse-managed), and the combination is no longer present in the
 * Loyverse items list.
 *
 * Uses bulk fetches to avoid N+1 queries.
 */
async function removeStaleModifierLinks(
  items: LoyverseRawItem[],
  result: FullSyncResult
): Promise<void> {
  try {
    // Bulk fetch all Loyverse product and group maps
    const [allProductMaps, allGroupMaps] = await Promise.all([
      prisma.externalProductMap.findMany({
        where: { source: IntegrationSource.LOYVERSE },
        select: { externalProductId: true, productId: true },
      }),
      prisma.externalOptionGroupMap.findMany({
        where: { source: IntegrationSource.LOYVERSE },
        select: { externalOptionGroupId: true, optionGroupId: true },
      }),
    ]);

    // Build lookup maps
    const extProductToInternal = new Map(
      allProductMaps.map((m) => [m.externalProductId, m.productId])
    );
    const extGroupToInternal = new Map(
      allGroupMaps.map((m) => [m.externalOptionGroupId, m.optionGroupId])
    );

    // Build the set of valid (productId, optionGroupId) pairs from Loyverse items
    const validPairs = new Set<string>();
    for (const item of items) {
      const productId = extProductToInternal.get(item.id);
      if (!productId) continue;
      for (const modifierId of item.modifier_ids ?? []) {
        const optionGroupId = extGroupToInternal.get(modifierId);
        if (!optionGroupId) continue;
        validPairs.add(`${productId}:${optionGroupId}`);
      }
    }

    // Find all existing assignments for Loyverse-synced products + groups
    const loyverseProductIds = [...extProductToInternal.values()];
    const loyverseGroupIds = [...extGroupToInternal.values()];

    const existingAssignments = await prisma.productOptionGroupAssignment.findMany({
      where: {
        productId: { in: loyverseProductIds },
        optionGroupId: { in: loyverseGroupIds },
      },
      select: { productId: true, optionGroupId: true },
    });

    for (const assignment of existingAssignments) {
      const key = `${assignment.productId}:${assignment.optionGroupId}`;
      if (!validPairs.has(key)) {
        await prisma.productOptionGroupAssignment.delete({
          where: {
            productId_optionGroupId: {
              productId: assignment.productId,
              optionGroupId: assignment.optionGroupId,
            },
          },
        });
        result.staleLinksRemoved++;
        console.info(
          `[full-sync] Removed stale link productId=${assignment.productId} optionGroupId=${assignment.optionGroupId}`
        );
      }
    }
  } catch (err) {
    console.error("[full-sync] Error during stale link cleanup:", err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveItemPrice(item: LoyverseRawItem): number {
  const firstVariant = item.variants[0];
  if (!firstVariant) return 0;
  if (firstVariant.default_price != null) return firstVariant.default_price;
  return firstVariant.stores[0]?.price ?? 0;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let candidate = base;
  let i = 1;
  while (await prisma.product.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${i++}`;
  }
  return candidate;
}
