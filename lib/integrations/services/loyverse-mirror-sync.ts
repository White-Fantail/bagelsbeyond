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
    const activeItems = items.filter((item) => item.deleted_at === null);
    await syncItems(activeItems, result);
    console.info(`[mirror-sync] Items synced: ${result.itemsSynced}`);

    // Step 4: Item-Modifier links
    console.info("[mirror-sync] Step 4: Syncing item-modifier links…");
    await syncItemModifierLinks(activeItems, result);
    console.info(`[mirror-sync] Item-modifier links synced: ${result.itemModifierLinksSynced}`);

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

  const duration = ((result.finishedAt.getTime() - result.startedAt.getTime()) / 1000).toFixed(1);
  console.info(
    `[mirror-sync] DONE status=${result.status} duration=${duration}s ` +
      `categories=${result.categoriesSynced} modifiers=${result.modifiersSynced} ` +
      `options=${result.modifierOptionsSynced} items=${result.itemsSynced} ` +
      `links=${result.itemModifierLinksSynced} variants=${result.variantsSynced} ` +
      `inventory=${result.inventoryLevelsSynced} errors=${result.errorCount}`
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
  for (const item of items) {
    try {
      const modifierIds = item.modifiers_ids ?? [];

      // Delete existing links for this item then re-insert from Loyverse
      await prisma.loyverseItemModifier.deleteMany({
        where: { itemId: item.id },
      });

      for (const modifierId of modifierIds) {
        try {
          await prisma.loyverseItemModifier.create({
            data: { itemId: item.id, modifierId },
          });
          result.itemModifierLinksSynced++;
        } catch (err) {
          const msg = `Item-modifier link item=${item.id} modifier=${modifierId}: ${String(err)}`;
          result.errors.push(msg);
          result.errorCount++;
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
