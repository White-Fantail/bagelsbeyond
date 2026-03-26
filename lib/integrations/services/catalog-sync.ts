// ─── Catalog Sync Service ─────────────────────────────────────────────────────
// Syncs external POS product catalogue to internal Product + ExternalProductMap.
// This is a server-side service — import with "server-only" in mind.

import { prisma } from "@/lib/db";
import type { POSAdapter, ExternalProduct } from "../adapters/pos/types";
import { mapExternalProductToInternal } from "../adapters/pos/types";
import { IntegrationSource, ProductCategory } from "@/app/generated/prisma/enums";

export interface CatalogSyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
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
  const result: CatalogSyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  const fetchResult = await adapter.fetchExternalCatalog();
  if (!fetchResult.success || !fetchResult.data) {
    result.errors.push(fetchResult.error ?? "Failed to fetch catalogue");
    return result;
  }

  for (const extProduct of fetchResult.data) {
    try {
      await upsertExternalProduct(extProduct, source);
      result.updated++;
    } catch (err) {
      result.errors.push(
        `Failed to sync product "${extProduct.name}" (${extProduct.externalId}): ${String(err)}`
      );
    }
  }

  return result;
}

async function upsertExternalProduct(
  ext: ExternalProduct,
  source: IntegrationSource
): Promise<void> {
  const internalData = mapExternalProductToInternal(ext);

  // Check if a mapping already exists
  const existingMap = await prisma.externalProductMap.findUnique({
    where: { source_externalProductId: { source, externalProductId: ext.externalId } },
    include: { product: true },
  });

  if (existingMap) {
    // Update the linked internal product
    await prisma.product.update({
      where: { id: existingMap.productId },
      data: {
        name: internalData.name,
        basePrice: internalData.basePrice,
        isActive: internalData.isActive,
        updatedAt: new Date(),
      },
    });
    await prisma.externalProductMap.update({
      where: { id: existingMap.id },
      data: { externalName: ext.name, lastSyncedAt: new Date() },
    });
    return;
  }

  // Create a new internal product + mapping
  const slug = slugify(ext.name);
  const uniqueSlug = await ensureUniqueSlug(slug);

  const product = await prisma.product.create({
    data: {
      name: internalData.name,
      slug: uniqueSlug,
      basePrice: internalData.basePrice,
      isActive: internalData.isActive,
      category: ProductCategory.OTHER,
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
