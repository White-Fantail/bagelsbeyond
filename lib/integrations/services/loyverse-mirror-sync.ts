// ─── Loyverse Mirror Sync Service ────────────────────────────────────────────
// Directly mirrors Loyverse data into dedicated local tables without any
// transformation to internal product/option models.
//
// Sync order (must not be changed — FK dependencies):
//   1. Categories  → loyverse_categories (existing table)
//   2. Modifiers   → loyverse_modifiers + loyverse_modifier_options
//   3. Items       → loyverse_items
//   4. Item-Modifier links → loyverse_item_modifiers (overwrite per item)
//   5. Variants    → loyverse_variants
//   6. Inventory   → loyverse_inventory_levels
//
// Usage:
//   const adapter = createLoyverseAdapter();
//   const result = await syncAllLoyverse(adapter);

import { prisma } from "@/lib/db";
import type { LoyverseAdapter } from "../adapters/pos/loyverse";
import type {
  LoyverseRawCategory,
  LoyverseRawModifier,
  LoyverseRawItem,
  LoyverseRawVariant,
  LoyverseRawInventoryLevel,
} from "../adapters/pos/types";

// ─── Result type ─────────────────────────────────────────────────────────────

export interface MirrorSyncResult {
  status: "success" | "partial" | "failed";
  startedAt: Date;
  finishedAt?: Date;
  categoriesSynced: number;
  modifiersSynced: number;
  modifierOptionsSynced: number;
  itemsSynced: number;
  itemModifierLinksSynced: number;
  variantsSynced: number;
  inventoryLevelsSynced: number;
  // ── HTTP pipeline diagnostics (populated from adapter.itemsDiagnostics) ───────
  /** Whether LOYVERSE_MOCK mode was active — no real HTTP request was made */
  loyverseMock: boolean;
  /** Actual /items URL that was called (null in mock mode) */
  itemsFetchUrl: string | null;
  /** HTTP response status from the /items call (null in mock mode) */
  itemsFetchHttpStatus: number | null;
  /** Whether the literal string `"modifier_ids"` appears in the raw HTTP body text */
  rawBodyContainsModifiersIds: boolean | null;
  /** First 10 000 characters of the raw HTTP body (null in mock mode) */
  rawBodyPreview: string | null;
  /** Always false — no fallback payload is used */
  usingFallback: boolean;
  /** Always false — no in-memory cache is used */
  usingCache: boolean;
  // ── Stage A: Raw API response (before deleted_at filter) ─────────────────────
  /** Total items returned by the Loyverse API (including deleted) */
  rawItemsTotal: number;
  /** Raw items that have the `modifier_ids` field present in the API response */
  rawItemsWithModifiersIds: number;
  /** Raw items that are missing the `modifier_ids` field in the API response */
  rawItemsWithoutModifiersIds: number;
  // ── Stage B: Parsed + active items (after deleted_at filter) ─────────────────
  /** Active items whose payload contained no modifier reference field at all */
  itemsWithoutModifierField: number;
  /** Active items that had the modifier field but it was an empty array */
  itemsWithEmptyModifiers: number;
  // ── Stage C: Final link creation ──────────────────────────────────────────────
  /** Modifier IDs that could not be matched in the local DB */
  modifierNotFoundLocally: number;
  /** Number of item-modifier link DB inserts that failed */
  linkInsertErrors: number;
  // ── Stage D: DB verification ──────────────────────────────────────────────────
  /** Actual row count in loyverse_item_modifiers after all inserts */
  itemModifierLinksPersisted: number;
  errorCount: number;
  errors: string[];
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Run a full Loyverse mirror sync:
 * categories → modifiers → items → item-modifier links → variants → inventory.
 */
export async function syncAllLoyverse(adapter: LoyverseAdapter): Promise<MirrorSyncResult> {
  const result: MirrorSyncResult = {
    status: "success",
    startedAt: new Date(),
    categoriesSynced: 0,
    modifiersSynced: 0,
    modifierOptionsSynced: 0,
    itemsSynced: 0,
    itemModifierLinksSynced: 0,
    variantsSynced: 0,
    inventoryLevelsSynced: 0,
    loyverseMock: false,
    itemsFetchUrl: null,
    itemsFetchHttpStatus: null,
    rawBodyContainsModifiersIds: null,
    rawBodyPreview: null,
    usingFallback: false,
    usingCache: false,
    rawItemsTotal: 0,
    rawItemsWithModifiersIds: 0,
    rawItemsWithoutModifiersIds: 0,
    itemsWithoutModifierField: 0,
    itemsWithEmptyModifiers: 0,
    modifierNotFoundLocally: 0,
    linkInsertErrors: 0,
    itemModifierLinksPersisted: 0,
    errorCount: 0,
    errors: [],
  };

  try {
    // Step 1: Categories
    console.info("[mirror-sync] Step 1: Syncing categories…");
    const categories = await adapter.fetchCategories();
    const activeCategories = categories.filter((c) => c.deleted_at === null);
    await syncCategories(activeCategories, result);
    console.info(`[mirror-sync] Categories synced: ${result.categoriesSynced}`);

    // Step 2: Modifiers (with options)
    console.info("[mirror-sync] Step 2: Syncing modifiers…");
    const modifiers = await adapter.fetchModifiers();
    const activeModifiers = modifiers.filter((m) => m.deleted_at === null);
    await syncModifiers(activeModifiers, result);
    console.info(
      `[mirror-sync] Modifiers synced: ${result.modifiersSynced}, options: ${result.modifierOptionsSynced}`
    );

    // Step 3: Items
    console.info("[mirror-sync] Step 3: Syncing items…");
    const items = await adapter.fetchItems();

    // ── HTTP pipeline diagnostics (populated by fetchItems) ───────────────────
    // These fields reveal what was in the actual HTTP body text, before any
    // JavaScript transformation, so we can determine at which stage
    // `modifier_ids` is present or absent.
    const diag = adapter.itemsDiagnostics;
    result.loyverseMock = diag?.loyverseMock ?? false;
    result.itemsFetchUrl = diag?.requestUrl ?? null;
    result.itemsFetchHttpStatus = diag?.httpStatus ?? null;
    result.rawBodyContainsModifiersIds = diag?.rawBodyContainsModifiersIds ?? null;
    result.rawBodyPreview = diag?.rawBodyPreview ?? null;
    result.usingFallback = false;
    result.usingCache = false;
    console.info(
      `[HTTP PIPELINE] LOYVERSE_MOCK=${result.loyverseMock} ` +
      `url=${result.itemsFetchUrl ?? "N/A"} ` +
      `httpStatus=${result.itemsFetchHttpStatus ?? "N/A"} ` +
      `rawBodyContainsModifiersIds=${result.rawBodyContainsModifiersIds ?? "N/A"} ` +
      `usingFallback=false usingCache=false`
    );

    // ── Stage A: After JSON.parse (before deleted_at filter) ───────────────────
    // NOTE: this stage operates on the already-JSON.parsed LoyverseRawItem[].
    // The HTTP raw body text check above is the true "before JSON.parse" stage.
    const rawItemsWithField = items.filter(
      (i) => "modifier_ids" in (i as unknown as Record<string, unknown>)
    );
    result.rawItemsTotal = items.length;
    result.rawItemsWithModifiersIds = rawItemsWithField.length;
    result.rawItemsWithoutModifiersIds = items.length - rawItemsWithField.length;
    console.info(
      `[STAGE A: after JSON.parse] total=${result.rawItemsTotal} ` +
      `with_modifier_ids=${result.rawItemsWithModifiersIds} ` +
      `without_modifier_ids=${result.rawItemsWithoutModifiersIds}`
    );
    items.slice(0, 3).forEach((item, idx) => {
      const rawObj = item as unknown as Record<string, unknown>;
      const modIds = rawObj["modifier_ids"];
      console.info(
        `[RAW ITEM #${idx + 1}] id=${item.id} name="${item.item_name}" ` +
        `modifier_ids=${modIds !== undefined ? JSON.stringify(modIds) : "FIELD ABSENT"}`
      );
    });

    const activeItems = items.filter((item) => item.deleted_at === null);

    // ── Stage B: Active (parsed) item diagnostics (after deleted_at filter) ───
    const activeWithField = activeItems.filter(
      (i) => "modifier_ids" in (i as unknown as Record<string, unknown>)
    );
    const activeWithNonEmpty = activeWithField.filter(
      (i) => Array.isArray(i.modifier_ids) && i.modifier_ids.length > 0
    );
    console.info(
      `[STAGE B: ACTIVE] total=${activeItems.length} ` +
      `with_modifier_ids_field=${activeWithField.length} ` +
      `with_non_empty_modifier_ids=${activeWithNonEmpty.length} ` +
      `deleted_filtered_out=${items.length - activeItems.length}`
    );
    activeItems.slice(0, 3).forEach((item, idx) => {
      const modIds = Array.isArray(item.modifier_ids) ? item.modifier_ids : [];
      console.info(
        `[PARSED ITEM #${idx + 1}] id=${item.id} name="${item.item_name}" ` +
        `modifier_ids=${JSON.stringify(modIds)}`
      );
    });

    await syncItems(activeItems, result);
    console.info(`[mirror-sync] Items synced: ${result.itemsSynced}`);

    // Step 4: Item-Modifier links
    console.info("[mirror-sync] Step 4: Syncing item-modifier links…");
    await syncItemModifierLinks(activeItems, result);
    // ── Stage C: Final link creation summary ─────────────────────────────────
    console.info(
      `[STAGE C: FINAL LINKS] links_created=${result.itemModifierLinksSynced} ` +
      `modifier_not_found_locally=${result.modifierNotFoundLocally} ` +
      `no_field_in_parsed=${result.itemsWithoutModifierField} ` +
      `empty_array_in_parsed=${result.itemsWithEmptyModifiers} ` +
      `insert_errors=${result.linkInsertErrors}`
    );
    console.info(`[mirror-sync] Item-modifier links synced: ${result.itemModifierLinksSynced}`);

    // ── Stage D: DB verification — count actual rows persisted ───────────────
    try {
      result.itemModifierLinksPersisted = await prisma.loyverseItemModifier.count();
      console.info(
        `[STAGE D: DB VERIFY] actual_rows_in_db=${result.itemModifierLinksPersisted}`
      );
    } catch (countErr) {
      console.error("[mirror-sync] Stage D DB count failed:", countErr);
    }

    // Step 5: Variants
    console.info("[mirror-sync] Step 5: Syncing variants…");
    const variants = await adapter.fetchVariants();
    await syncVariants(variants, result);
    console.info(`[mirror-sync] Variants synced: ${result.variantsSynced}`);

    // Step 6: Inventory
    console.info("[mirror-sync] Step 6: Syncing inventory…");
    const inventory = await adapter.fetchInventory();
    await syncInventory(inventory, result);
    console.info(`[mirror-sync] Inventory levels synced: ${result.inventoryLevelsSynced}`);

    result.status = result.errorCount > 0 ? "partial" : "success";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[mirror-sync] Fatal error:", message);
    result.errors.push(message);
    result.errorCount++;
    result.status = "failed";
  }

  result.finishedAt = new Date();

  // Persist sync summary to loyverse_full_sync_logs
  try {
    await prisma.loyverseFullSyncLog.create({
      data: {
        status: result.status,
        categoriesFetched: result.categoriesSynced,
        categoriesUpserted: result.categoriesSynced,
        productsFetched: result.itemsSynced,
        productsCreated: 0,
        productsUpdated: result.itemsSynced,
        modifierGroupsFetched: result.modifiersSynced,
        modifierGroupsUpserted: result.modifiersSynced,
        modifierOptionsFetched: result.modifierOptionsSynced,
        modifierOptionsUpserted: result.modifierOptionsSynced,
        categoryLinksUpdated: 0,
        modifierLinksUpdated: result.itemModifierLinksSynced,
        staleLinksRemoved: 0,
        skippedCount: result.itemsWithoutModifierField + result.itemsWithEmptyModifiers,
        errorCount: result.errorCount,
        errorMessage: result.errors.length > 0 ? result.errors.slice(0, 3).join("; ") : null,
        itemModifierLinksAttempted: result.itemModifierLinksSynced + result.linkInsertErrors,
        itemModifierLinksPersisted: result.itemModifierLinksPersisted,
      },
    });
  } catch (logErr) {
    console.error("[mirror-sync] Failed to persist sync log:", logErr);
  }

  const duration = ((result.finishedAt.getTime() - result.startedAt.getTime()) / 1000).toFixed(1);
  console.info(
    `[mirror-sync] DONE status=${result.status} duration=${duration}s ` +
      `categories=${result.categoriesSynced} modifiers=${result.modifiersSynced} ` +
      `options=${result.modifierOptionsSynced} items=${result.itemsSynced} ` +
      `links=${result.itemModifierLinksSynced} variants=${result.variantsSynced} ` +
      `inventory=${result.inventoryLevelsSynced} errors=${result.errorCount} ` +
      `[HTTP] mock=${result.loyverseMock} httpStatus=${result.itemsFetchHttpStatus ?? "N/A"} rawContainsModifiersIds=${result.rawBodyContainsModifiersIds ?? "N/A"} ` +
      `[A] rawTotal=${result.rawItemsTotal} rawWithField=${result.rawItemsWithModifiersIds} rawWithoutField=${result.rawItemsWithoutModifiersIds} ` +
      `[B] noModifierField=${result.itemsWithoutModifierField} emptyModifiers=${result.itemsWithEmptyModifiers} ` +
      `[C] modifierNotFound=${result.modifierNotFoundLocally} linkInsertErrors=${result.linkInsertErrors} ` +
      `[D] dbPersisted=${result.itemModifierLinksPersisted}`
  );

  return result;
}

// ─── Step 1: Categories ───────────────────────────────────────────────────────

async function syncCategories(
  categories: LoyverseRawCategory[],
  result: MirrorSyncResult
): Promise<void> {
  for (const cat of categories) {
    try {
      await prisma.loyverseCategory.upsert({
        where: { loyverseCategoryId: cat.id },
        create: {
          loyverseCategoryId: cat.id,
          name: cat.name,
          color: cat.color ?? null,
          isActive: true,
          rawPayload: cat as object,
        },
        update: {
          name: cat.name,
          color: cat.color ?? null,
          isActive: true,
          rawPayload: cat as object,
          updatedAt: new Date(),
        },
      });
      result.categoriesSynced++;
    } catch (err) {
      const msg = `Category "${cat.name}" (${cat.id}): ${String(err)}`;
      result.errors.push(msg);
      result.errorCount++;
      console.error("[mirror-sync] Category upsert error:", msg);
    }
  }
}

// ─── Step 2: Modifiers ────────────────────────────────────────────────────────

async function syncModifiers(
  modifiers: LoyverseRawModifier[],
  result: MirrorSyncResult
): Promise<void> {
  for (const mod of modifiers) {
    try {
      // Upsert modifier group
      await prisma.loyverseModifier.upsert({
        where: { id: mod.id },
        create: {
          id: mod.id,
          name: mod.name,
          minSelect: mod.min_select ?? null,
          maxSelect: mod.max_select ?? null,
          required: mod.required ?? false,
          updatedAt: new Date(mod.updated_at),
        },
        update: {
          name: mod.name,
          minSelect: mod.min_select ?? null,
          maxSelect: mod.max_select ?? null,
          required: mod.required ?? false,
          updatedAt: new Date(mod.updated_at),
        },
      });
      result.modifiersSynced++;

      // Upsert each option
      const options = mod.options ?? [];
      for (const opt of options) {
        try {
          await prisma.loyverseModifierOption.upsert({
            where: { id: opt.id },
            create: {
              id: opt.id,
              modifierId: mod.id,
              name: opt.name,
              price: opt.price,
              updatedAt: new Date(mod.updated_at),
            },
            update: {
              modifierId: mod.id,
              name: opt.name,
              price: opt.price,
              updatedAt: new Date(mod.updated_at),
            },
          });
          result.modifierOptionsSynced++;
        } catch (err) {
          const msg = `Modifier option "${opt.name}" (${opt.id}) in modifier ${mod.id}: ${String(err)}`;
          result.errors.push(msg);
          result.errorCount++;
          console.error("[mirror-sync] Modifier option upsert error:", msg);
        }
      }
    } catch (err) {
      const msg = `Modifier "${mod.name}" (${mod.id}): ${String(err)}`;
      result.errors.push(msg);
      result.errorCount++;
      console.error("[mirror-sync] Modifier upsert error:", msg);
    }
  }
}

// ─── Step 3: Items ────────────────────────────────────────────────────────────

async function syncItems(
  items: LoyverseRawItem[],
  result: MirrorSyncResult
): Promise<void> {
  for (const item of items) {
    try {
      const defaultPrice = item.variants?.[0]?.default_price ?? null;
      await prisma.loyverseItem.upsert({
        where: { id: item.id },
        create: {
          id: item.id,
          name: item.item_name,
          description: item.description ?? null,
          categoryId: item.category_id ?? null,
          price: defaultPrice,
          updatedAt: new Date(item.updated_at),
        },
        update: {
          name: item.item_name,
          description: item.description ?? null,
          categoryId: item.category_id ?? null,
          price: defaultPrice,
          updatedAt: new Date(item.updated_at),
        },
      });
      result.itemsSynced++;
    } catch (err) {
      const msg = `Item "${item.item_name}" (${item.id}): ${String(err)}`;
      result.errors.push(msg);
      result.errorCount++;
      console.error("[mirror-sync] Item upsert error:", msg);
    }
  }
}

// ─── Step 4: Item-Modifier links ──────────────────────────────────────────────

async function syncItemModifierLinks(
  items: LoyverseRawItem[],
  result: MirrorSyncResult
): Promise<void> {
  // Pre-load all known modifier IDs to avoid N+1 queries
  const knownModifiers = await prisma.loyverseModifier.findMany({ select: { id: true } });
  const knownModifierIds = new Set(knownModifiers.map((m: { id: string }) => m.id));

  for (const item of items) {
    try {
      // Case 1: modifier reference field is completely absent from the payload
      const hasModifierField = "modifier_ids" in (item as object);
      if (!hasModifierField) {
        result.itemsWithoutModifierField++;
        console.warn(
          `[mirror-sync] API response does not include modifier references for item "${item.item_name}" (${item.id})`
        );
        continue;
      }

      const modifierIds = item.modifier_ids ?? [];

      // Delete existing links for this item then re-insert from Loyverse
      await prisma.loyverseItemModifier.deleteMany({
        where: { itemId: item.id },
      });

      // Case 3: modifier field present but empty
      if (modifierIds.length === 0) {
        result.itemsWithEmptyModifiers++;
        console.info(
          `[mirror-sync] Item "${item.item_name}" (${item.id}) has no modifiers assigned in Loyverse`
        );
        continue;
      }

      for (const modifierId of modifierIds) {
        // Case 2: modifier ID not found in local DB
        if (!knownModifierIds.has(modifierId)) {
          result.modifierNotFoundLocally++;
          console.warn(
            `[mirror-sync] Modifier not found in local DB: modifier=${modifierId} for item "${item.item_name}" (${item.id})`
          );
          continue;
        }

        try {
          await prisma.loyverseItemModifier.create({
            data: { itemId: item.id, modifierId },
          });
          result.itemModifierLinksSynced++;
        } catch (err) {
          // Case 4: DB insert failure
          result.linkInsertErrors++;
          result.errorCount++;
          const msg = `Item-modifier link item=${item.id} modifier=${modifierId}: ${String(err)}`;
          result.errors.push(msg);
          console.error("[mirror-sync] Item-modifier link error:", msg);
        }
      }
    } catch (err) {
      const msg = `Item-modifier link cleanup for item ${item.id}: ${String(err)}`;
      result.errors.push(msg);
      result.errorCount++;
      console.error("[mirror-sync] Item-modifier deleteMany error:", msg);
    }
  }

  // Summary log
  console.info(
    `[mirror-sync] Item-modifier link summary: ` +
      `links=${result.itemModifierLinksSynced} ` +
      `noField=${result.itemsWithoutModifierField} ` +
      `emptyList=${result.itemsWithEmptyModifiers} ` +
      `notFoundLocally=${result.modifierNotFoundLocally} ` +
      `insertErrors=${result.linkInsertErrors}`
  );
}

// ─── Step 5: Variants ─────────────────────────────────────────────────────────

async function syncVariants(
  variants: LoyverseRawVariant[],
  result: MirrorSyncResult
): Promise<void> {
  for (const variant of variants) {
    try {
      const price = variant.default_price ?? variant.stores?.[0]?.price ?? null;
      const updatedAt = variant.updated_at ? new Date(variant.updated_at) : new Date();
      await prisma.loyverseVariant.upsert({
        where: { id: variant.variant_id },
        create: {
          id: variant.variant_id,
          itemId: variant.item_id,
          sku: variant.sku ?? null,
          price,
          updatedAt,
        },
        update: {
          itemId: variant.item_id,
          sku: variant.sku ?? null,
          price,
          updatedAt,
        },
      });
      result.variantsSynced++;
    } catch (err) {
      const msg = `Variant ${variant.variant_id} (item ${variant.item_id}): ${String(err)}`;
      result.errors.push(msg);
      result.errorCount++;
      console.error("[mirror-sync] Variant upsert error:", msg);
    }
  }
}

// ─── Step 6: Inventory ────────────────────────────────────────────────────────

async function syncInventory(
  levels: LoyverseRawInventoryLevel[],
  result: MirrorSyncResult
): Promise<void> {
  for (const level of levels) {
    try {
      await prisma.loyverseInventoryLevel.upsert({
        where: { variantId: level.variant_id },
        create: {
          variantId: level.variant_id,
          inStock: level.in_stock,
          updatedAt: new Date(level.updated_at),
        },
        update: {
          inStock: level.in_stock,
          updatedAt: new Date(level.updated_at),
        },
      });
      result.inventoryLevelsSynced++;
    } catch (err) {
      const msg = `Inventory level variant=${level.variant_id}: ${String(err)}`;
      result.errors.push(msg);
      result.errorCount++;
      console.error("[mirror-sync] Inventory upsert error:", msg);
    }
  }
}
