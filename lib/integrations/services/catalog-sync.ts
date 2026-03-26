// ─── Catalog Sync Service ─────────────────────────────────────────────────────
// Syncs external POS product catalogue to internal Product + ExternalProductMap.
// This is a server-side service — always import from server components / API routes.
//
// ═══════════════════════════════════════════════════════════════════════════════
// SYNC POLICY OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════
//
// One external item  →  one internal Product
//
// Overwritten on every sync:   name, description, basePrice, isActive, category
// Protected (never touched):   slug, sortOrder, isSubscriptionEligible
//
// Option / modifier groups:
//   • Groups and options are upserted by externalId.
//   • name, priceDelta are overwritten.
//   • minSelect / maxSelect / isRequired keep their current value after creation
//     so operators can tune selection rules without losing them on next sync.
//
// See catalog-mapper.ts for field-level documentation.
// ═══════════════════════════════════════════════════════════════════════════════

import { prisma } from "@/lib/db";
import type { POSAdapter, ExternalProduct, ExternalModifierGroup } from "../adapters/pos/types";
import { buildSyncedProductFields } from "./catalog-mapper";
import { IntegrationSource, ProductCategory } from "@/app/generated/prisma/enums";

export interface CatalogSyncResult {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  startedAt: Date;
  finishedAt?: Date;
}

/**
 * Fetch the external POS catalogue and upsert into internal Products
 * plus ExternalProductMap entries.
 *
 * Usage:
 *   const adapter = createLoyverseAdapter();
 *   const result = await syncExternalCatalog(adapter, IntegrationSource.LOYVERSE);
 */
export async function syncExternalCatalog(
  adapter: POSAdapter,
  source: IntegrationSource
): Promise<CatalogSyncResult> {
  const result: CatalogSyncResult = {
    fetched: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    startedAt: new Date(),
  };

  const fetchResult = await adapter.fetchExternalCatalog();
  if (!fetchResult.success || !fetchResult.data) {
    result.errors.push(fetchResult.error ?? "Failed to fetch catalogue");
    result.finishedAt = new Date();
    return result;
  }

  result.fetched = fetchResult.data.length;

  for (const extProduct of fetchResult.data) {
    try {
      const wasCreated = await upsertExternalProduct(extProduct, source);
      if (wasCreated) {
        result.created++;
      } else {
        result.updated++;
      }
    } catch (err) {
      result.errors.push(
        `Failed to sync product "${extProduct.name}" (${extProduct.externalId}): ${String(err)}`
      );
    }
  }

  result.finishedAt = new Date();
  return result;
}

// ─── Upsert helpers ───────────────────────────────────────────────────────────

/**
 * Upsert a single external product into the internal database.
 * Returns true if a new Product was created, false if an existing one was updated.
 */
async function upsertExternalProduct(
  ext: ExternalProduct,
  source: IntegrationSource
): Promise<boolean> {
  const syncedFields = buildSyncedProductFields(ext);

  // Check for an existing external → internal mapping
  const existingMap = await prisma.externalProductMap.findUnique({
    where: {
      source_externalProductId: { source, externalProductId: ext.externalId },
    },
    include: { product: true },
  });

  if (existingMap) {
    // ── UPDATE path ──────────────────────────────────────────────────────────
    // Only overwrite the fields defined by sync policy; leave sortOrder,
    // isSubscriptionEligible, and slug untouched.
    await prisma.product.update({
      where: { id: existingMap.productId },
      data: {
        ...syncedFields,
        updatedAt: new Date(),
      },
    });
    await prisma.externalProductMap.update({
      where: { id: existingMap.id },
      data: { externalName: ext.name, lastSyncedAt: new Date() },
    });

    // Sync option groups if present
    if (ext.modifierGroups?.length) {
      await syncOptionGroups(existingMap.productId, ext.modifierGroups);
    }

    return false; // updated
  }

  // ── CREATE path ─────────────────────────────────────────────────────────────
  const slug = slugify(ext.name);
  const uniqueSlug = await ensureUniqueSlug(slug);

  const product = await prisma.product.create({
    data: {
      ...syncedFields,
      slug: uniqueSlug,
      // Fallback: if category mapping returns OTHER but external category
      // was empty, keep OTHER (operators can reclassify).
      category: syncedFields.category ?? ProductCategory.OTHER,
    },
  });

  await prisma.externalProductMap.create({
    data: {
      source,
      externalProductId: ext.externalId,
      productId: product.id,
      externalName: ext.name,
      lastSyncedAt: new Date(),
    },
  });

  // Sync option groups if present
  if (ext.modifierGroups?.length) {
    await syncOptionGroups(product.id, ext.modifierGroups);
  }

  return true; // created
}

// ─── Option / modifier group sync ─────────────────────────────────────────────

/**
 * Upsert ProductOptionGroup + ProductOption records from external modifier groups.
 *
 * Policy:
 *   • Group identified by (productId, name) — no external ID column on
 *     ProductOptionGroup; if multiple groups share a name, the first is updated.
 *   • minSelect / maxSelect / isRequired are set to sensible defaults on creation
 *     and are NOT overwritten on subsequent syncs (allow operator tuning).
 *   • Options are identified by (optionGroupId, name).
 *   • priceDelta is always overwritten from POS.
 *
 * NOTE — Incomplete area (Phase 5A):
 *   External modifier group IDs are not persisted in a separate mapping table yet.
 *   This means renaming a group in Loyverse will result in a duplicate group.
 *   A future phase should add an ExternalOptionGroupMap model to fix this.
 */
async function syncOptionGroups(
  productId: string,
  modifierGroups: ExternalModifierGroup[]
): Promise<void> {
  for (const extGroup of modifierGroups) {
    // Attempt to find an existing group by name under this product
    const existingGroup = await prisma.productOptionGroup.findFirst({
      where: { productId, name: extGroup.name },
      include: { options: true },
    });

    if (existingGroup) {
      // Update options only; do not overwrite minSelect / maxSelect / isRequired
      await syncOptions(existingGroup.id, extGroup.modifiers, existingGroup.options);
    } else {
      // Create the group with conservative defaults
      const newGroup = await prisma.productOptionGroup.create({
        data: {
          productId,
          name: extGroup.name,
          minSelect: 0,
          maxSelect: 1,
          isRequired: false,
        },
      });
      await syncOptions(newGroup.id, extGroup.modifiers, []);
    }
  }
}

type ExistingOption = { id: string; name: string };

/**
 * Upsert ProductOption rows from external modifier items.
 */
async function syncOptions(
  optionGroupId: string,
  modifiers: ExternalModifierGroup["modifiers"],
  existingOptions: ExistingOption[]
): Promise<void> {
  const existingByName = new Map(existingOptions.map((o) => [o.name, o]));

  for (const modifier of modifiers) {
    const existing = existingByName.get(modifier.name);
    if (existing) {
      await prisma.productOption.update({
        where: { id: existing.id },
        data: { priceDelta: modifier.priceDelta, isActive: true },
      });
    } else {
      await prisma.productOption.create({
        data: {
          optionGroupId,
          name: modifier.name,
          priceDelta: modifier.priceDelta,
          isActive: true,
        },
      });
    }
  }
}

// ─── Slug helpers ─────────────────────────────────────────────────────────────

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
