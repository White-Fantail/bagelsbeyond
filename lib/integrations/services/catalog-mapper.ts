// ─── Catalog Mapper ───────────────────────────────────────────────────────────
// Converts Loyverse raw API types into POS-agnostic ExternalProduct types,
// and maps ExternalProduct fields into internal Product fields.
//
// ═══════════════════════════════════════════════════════════════════════════════
// SYNC POLICY — which fields are overwritten on each sync
// ═══════════════════════════════════════════════════════════════════════════════
//
// Fields OVERWRITTEN from external source every sync:
//   • name         — always kept in sync with POS display name
//   • description  — kept in sync; set to null if absent externally
//   • basePrice    — the "default" variant price from POS
//   • isActive     — reflects POS availability (deleted_at / available_for_sale)
//   • category     — mapped from Loyverse category name → ProductCategory
//
// Fields NEVER overwritten (managed internally only):
//   • slug                  — unique URL key, set on creation only
//   • sortOrder             — managed by operators in admin UI
//   • isSubscriptionEligible — business decision, not from POS
//   • description (if operator manually edited) — CURRENTLY overwritten;
//     if you want to protect manual edits, add a `descriptionOverride` field
//
// Option / modifier groups:
//   • name        — overwritten from POS modifier group name
//   • minSelect   — defaults to 0 (Loyverse does not expose required flag)
//   • maxSelect   — defaults to 1 (single-select assumed; adjust per group)
//   • isRequired  — defaults to false (update manually per group after sync)
//   • Option.name       — overwritten from POS modifier name
//   • Option.priceDelta — overwritten from POS modifier price
//   • Option.isActive   — always true on sync; deactivate manually if needed
//
// NOTE: The first sync of a new item sets category to OTHER when no matching
//       ProductCategory is found. Operators can update the category manually.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  LoyverseRawItem,
  LoyverseRawCategory,
  LoyverseRawModifier,
  LoyverseCatalogRaw,
  ExternalProduct,
  ExternalModifierGroup,
  ExternalModifier,
} from "../adapters/pos/types";
import { ProductCategory } from "@/app/generated/prisma/enums";

// ─── Loyverse → ExternalProduct mapping ──────────────────────────────────────

/**
 * Determine the default sale price for a Loyverse item.
 * Uses the first variant's default_price; falls back to the first store price.
 */
function resolveItemPrice(item: LoyverseRawItem): number {
  const firstVariant = item.variants[0];
  if (!firstVariant) return 0;
  if (firstVariant.default_price != null) return firstVariant.default_price;
  const storePrice = firstVariant.stores[0]?.price;
  return storePrice ?? 0;
}

/**
 * Determine the SKU for a Loyverse item.
 * Uses the first variant's SKU or reference_id.
 */
function resolveItemSku(item: LoyverseRawItem): string | undefined {
  const first = item.variants[0];
  return first?.sku ?? first?.reference_id ?? undefined;
}

/**
 * Map a Loyverse modifier to a POS-agnostic ExternalModifierGroup.
 * In the Loyverse API, a "modifier" is the top-level entity (the group),
 * and its selectable items are called "options".
 */
function mapModifierGroup(raw: LoyverseRawModifier): ExternalModifierGroup {
  const modifiers: ExternalModifier[] = raw.options.map((o) => ({
    externalId: o.id,
    name: o.name,
    priceDelta: o.price,
  }));
  return {
    externalId: raw.id,
    name: raw.name,
    modifiers,
  };
}

/**
 * Convert a single Loyverse raw item to the POS-agnostic ExternalProduct type.
 * Requires a pre-built lookup maps for categories and modifiers.
 */
function mapLoyverseItem(
  item: LoyverseRawItem,
  categoryMap: Map<string, LoyverseRawCategory>,
  modifierMap: Map<string, LoyverseRawModifier>
): ExternalProduct {
  const category = item.category_id ? categoryMap.get(item.category_id) : undefined;
    const modifierGroups = (item.modifiers_ids ?? [])
    .map((id) => modifierMap.get(id))
    .filter((g): g is LoyverseRawModifier => g !== undefined)
    .map(mapModifierGroup);

  return {
    externalId: item.id,
    name: item.item_name,
    description: item.description ?? undefined,
    sku: resolveItemSku(item),
    price: resolveItemPrice(item),
    category: category?.name,
    // Active if not deleted and at least one variant is available for sale
    isActive:
      item.deleted_at === null &&
      item.variants.some((v) => v.stores.some((s) => s.available_for_sale)),
    modifierGroups: modifierGroups.length > 0 ? modifierGroups : undefined,
    updatedAt: item.updated_at,
  };
}

/**
 * Normalise a full Loyverse raw catalogue into ExternalProduct[].
 * Filters out deleted items.
 */
export function normalizeLoyverseCatalog(raw: LoyverseCatalogRaw): ExternalProduct[] {
  const categoryMap = new Map(raw.categories.map((c) => [c.id, c]));
  const modifierMap = new Map(raw.modifiers.map((m) => [m.id, m]));

  return raw.items
    .filter((item) => item.deleted_at === null)
    .map((item) => mapLoyverseItem(item, categoryMap, modifierMap));
}

// ─── ExternalProduct → internal Product field mapping ─────────────────────────

/**
 * Map an external category name to the nearest internal ProductCategory.
 * Returns OTHER when no match is found.
 */
export function mapExternalCategory(externalCategoryName?: string): ProductCategory {
  if (!externalCategoryName) return ProductCategory.OTHER;

  const name = externalCategoryName.toLowerCase();
  if (name.includes("bagel")) return ProductCategory.BAGEL;
  if (name.includes("sandwich") || name.includes("wrap") || name.includes("sub") || name.includes("panini")) return ProductCategory.SANDWICH;
  if (name.includes("spread") || name.includes("cream")) return ProductCategory.SPREAD;
  if (
    name.includes("drink") ||
    name.includes("coffee") ||
    name.includes("tea") ||
    name.includes("juice") ||
    name.includes("water")
  )
    return ProductCategory.DRINK;
  return ProductCategory.OTHER;
}

/**
 * Build the set of Product fields that should be written/updated on every sync.
 * Fields NOT included here are never touched by catalog sync.
 *
 * Sync policy summary (see file header for details):
 *   Overwritten: name, description, basePrice, isActive, category
 *   Protected:   slug, sortOrder, isSubscriptionEligible
 */
export function buildSyncedProductFields(ext: ExternalProduct): {
  name: string;
  description: string | null;
  basePrice: number;
  isActive: boolean;
  category: ProductCategory;
} {
  return {
    name: ext.name,
    description: ext.description ?? null,
    basePrice: ext.price,
    isActive: ext.isActive,
    category: mapExternalCategory(ext.category),
  };
}
