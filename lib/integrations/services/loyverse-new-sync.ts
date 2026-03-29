// ─── Loyverse New Full Sync Service ──────────────────────────────────────────
// Implements the new 3-layer architecture sync:
//   Layer A: Channel Mirror — stores Loyverse data faithfully in channel_* tables
//   Layer B: Canonical — creates/updates canonical Beyond entities
//   Layer C: Mapping — links canonical entities to mirrored channel entities
//
// Sync order (must not be changed — FK dependencies):
//   1. Categories  → ChannelCategory → Category + CategoryChannelMapping
//   2. Modifiers   → ChannelModifierGroup + ChannelModifierOption
//                  → ProductOptionGroup + ModifierGroupChannelMapping
//                  → ProductOption + ModifierOptionChannelMapping
//   3. Items       → ChannelProduct
//                  → Product + ProductChannelMapping
//   4. Product-Modifier links → ChannelProductModifierGroupLink
//                             → ProductOptionGroupAssignment
//   5. Mark deleted mirror records (soft delete)
//
// SOURCE OF TRUTH POLICY:
//   Loyverse-owned fields: name, price, structure, linked modifier groups, category.
//   Beyond-owned fields: soldOut, voiceAlias, notes, isVisible overrides.
//   Beyond-owned fields are NEVER overwritten by Loyverse sync.
//
// EXTERNAL COMMUNICATION RULE:
//   When communicating with any external channel API, ALWAYS resolve external
//   IDs through channel-id-resolver.ts. NEVER use canonical Beyond IDs directly.

import { prisma } from "@/lib/db";
import { ChannelType, MappingStatus, SyncDirection } from "@/app/generated/prisma/enums";
import type { LoyverseAdapter } from "../adapters/pos/loyverse";
import type {
  LoyverseRawCategory,
  LoyverseRawModifier,
  LoyverseRawItem,
} from "../adapters/pos/types";

// ─── Result type ─────────────────────────────────────────────────────────────

export interface LoyverseNewSyncResult {
  status: "success" | "partial" | "failed";
  startedAt: Date;
  finishedAt?: Date;
  // Mirror layer counts
  mirrorCategoriesUpserted: number;
  mirrorModifierGroupsUpserted: number;
  mirrorModifierOptionsUpserted: number;
  mirrorProductsUpserted: number;
  mirrorProductModifierLinksUpserted: number;
  mirrorRecordsMarkedDeleted: number;
  // Canonical layer counts
  canonicalCategoriesCreated: number;
  canonicalCategoriesUpdated: number;
  canonicalModifierGroupsCreated: number;
  canonicalModifierGroupsUpdated: number;
  canonicalModifierOptionsCreated: number;
  canonicalModifierOptionsUpdated: number;
  canonicalProductsCreated: number;
  canonicalProductsUpdated: number;
  canonicalProductModifierLinksUpserted: number;
  // Mapping layer counts
  categoryMappingsCreated: number;
  productMappingsCreated: number;
  modifierGroupMappingsCreated: number;
  modifierOptionMappingsCreated: number;
  // Error tracking
  errorCount: number;
  errors: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generates a URL-safe slug from a name. */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Ensures a slug is unique by appending a counter if needed. */
async function ensureUniqueSlug(
  baseSlug: string,
  existingId?: string
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;
  for (;;) {
    const existing = await prisma.category
      .findUnique({ where: { slug } })
      .catch(() => null);
    if (!existing || existing.id === existingId) return slug;
    slug = `${baseSlug}-${counter++}`;
  }
}

async function ensureUniqueProductSlug(
  baseSlug: string,
  existingId?: string
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;
  for (;;) {
    const existing = await prisma.product
      .findUnique({ where: { slug } })
      .catch(() => null);
    if (!existing || existing.id === existingId) return slug;
    slug = `${baseSlug}-${counter++}`;
  }
}

const now = () => new Date();

// ─── Step 1: Sync Categories ─────────────────────────────────────────────────

/**
 * Upserts Loyverse categories into the mirror layer, then creates or updates
 * canonical Category records and CategoryChannelMapping records.
 *
 * Returns a map of Loyverse category external ID → canonical Category ID.
 */
async function syncMirrorCategories(
  activeCategories: LoyverseRawCategory[],
  result: LoyverseNewSyncResult
): Promise<Map<string, string>> {
  // Maps Loyverse externalId → canonical categoryId
  const categoryIdMap = new Map<string, string>();
  const syncedAt = now();

  for (const raw of activeCategories) {
    try {
      // ── Mirror layer: upsert ChannelCategory ────────────────────────────────
      const channelCategory = await prisma.channelCategory.upsert({
        where: { channel_externalId: { channel: ChannelType.LOYVERSE, externalId: raw.id } },
        create: {
          channel: ChannelType.LOYVERSE,
          externalId: raw.id,
          name: raw.name,
          rawPayload: raw as object,
          lastSyncedAt: syncedAt,
          isDeleted: false,
        },
        update: {
          name: raw.name,
          rawPayload: raw as object,
          lastSyncedAt: syncedAt,
          isDeleted: false,
        },
      });
      result.mirrorCategoriesUpserted++;

      // ── Mapping layer: find existing mapping ────────────────────────────────
      const existingMapping = await prisma.categoryChannelMapping.findUnique({
        where: { channelCategoryId: channelCategory.id },
        include: { category: true },
      });

      if (existingMapping) {
        // ── Canonical layer: update existing category (Loyverse-owned fields) ──
        await prisma.category.update({
          where: { id: existingMapping.categoryId },
          data: {
            name: raw.name,
            updatedAt: now(),
          },
        });
        await prisma.categoryChannelMapping.update({
          where: { id: existingMapping.id },
          data: { lastSyncAt: syncedAt, status: MappingStatus.ACTIVE },
        });
        result.canonicalCategoriesUpdated++;
        categoryIdMap.set(raw.id, existingMapping.categoryId);
      } else {
        // ── Canonical layer: create new canonical Category ───────────────────
        const slug = await ensureUniqueSlug(toSlug(raw.name));
        const category = await prisma.category.create({
          data: {
            name: raw.name,
            slug,
            isActive: true,
            isVisible: true,
            displayOrder: 0,
          },
        });
        result.canonicalCategoriesCreated++;

        // ── Mapping layer: create CategoryChannelMapping ─────────────────────
        await prisma.categoryChannelMapping.create({
          data: {
            categoryId: category.id,
            channel: ChannelType.LOYVERSE,
            channelCategoryId: channelCategory.id,
            status: MappingStatus.ACTIVE,
            syncDirection: SyncDirection.PULL,
            lastMappedAt: syncedAt,
            lastSyncAt: syncedAt,
          },
        });
        result.categoryMappingsCreated++;
        categoryIdMap.set(raw.id, category.id);
      }
    } catch (err) {
      const msg = `[sync-categories] Error processing category ${raw.id}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(msg);
      result.errors.push(msg);
      result.errorCount++;
    }
  }

  return categoryIdMap;
}

// ─── Step 2: Sync Modifier Groups + Options ───────────────────────────────────

/**
 * Upserts Loyverse modifier groups and options into the mirror layer,
 * then creates or updates canonical ProductOptionGroup / ProductOption records.
 *
 * Returns a map of Loyverse modifier external ID → canonical ProductOptionGroup ID.
 */
async function syncMirrorModifierGroups(
  activeModifiers: LoyverseRawModifier[],
  result: LoyverseNewSyncResult
): Promise<Map<string, string>> {
  // Maps Loyverse modifier externalId → canonical modifierGroupId
  const modifierGroupIdMap = new Map<string, string>();
  const syncedAt = now();

  for (const raw of activeModifiers) {
    try {
      // ── Mirror layer: upsert ChannelModifierGroup ────────────────────────────
      const channelGroup = await prisma.channelModifierGroup.upsert({
        where: { channel_externalId: { channel: ChannelType.LOYVERSE, externalId: raw.id } },
        create: {
          channel: ChannelType.LOYVERSE,
          externalId: raw.id,
          name: raw.name,
          minSelect: raw.min_select ?? null,
          maxSelect: raw.max_select ?? null,
          rawPayload: raw as object,
          lastSyncedAt: syncedAt,
          isDeleted: false,
        },
        update: {
          name: raw.name,
          minSelect: raw.min_select ?? null,
          maxSelect: raw.max_select ?? null,
          rawPayload: raw as object,
          lastSyncedAt: syncedAt,
          isDeleted: false,
        },
      });
      result.mirrorModifierGroupsUpserted++;

      // ── Mapping layer: find existing mapping ────────────────────────────────
      const existingGroupMapping = await prisma.modifierGroupChannelMapping.findUnique({
        where: { channelModifierGroupId: channelGroup.id },
      });

      let canonicalGroupId: string;

      if (existingGroupMapping) {
        // ── Canonical layer: update existing group (Loyverse-owned fields) ────
        await prisma.productOptionGroup.update({
          where: { id: existingGroupMapping.modifierGroupId },
          data: {
            name: raw.name,
            minSelect: raw.min_select ?? 0,
            maxSelect: raw.max_select ?? 1,
            updatedAt: now(),
          },
        });
        await prisma.modifierGroupChannelMapping.update({
          where: { id: existingGroupMapping.id },
          data: { lastSyncAt: syncedAt, status: MappingStatus.ACTIVE },
        });
        result.canonicalModifierGroupsUpdated++;
        canonicalGroupId = existingGroupMapping.modifierGroupId;
      } else {
        // ── Canonical layer: create new canonical ProductOptionGroup ──────────
        const group = await prisma.productOptionGroup.create({
          data: {
            name: raw.name,
            minSelect: raw.min_select ?? 0,
            maxSelect: raw.max_select ?? 1,
            isRequired: raw.required ?? false,
            isActive: true,
            isVisible: true,
            displayOrder: 0,
          },
        });
        result.canonicalModifierGroupsCreated++;
        canonicalGroupId = group.id;

        // ── Mapping layer: create ModifierGroupChannelMapping ─────────────────
        await prisma.modifierGroupChannelMapping.create({
          data: {
            modifierGroupId: canonicalGroupId,
            channel: ChannelType.LOYVERSE,
            channelModifierGroupId: channelGroup.id,
            status: MappingStatus.ACTIVE,
            syncDirection: SyncDirection.PULL,
            lastMappedAt: syncedAt,
            lastSyncAt: syncedAt,
          },
        });
        result.modifierGroupMappingsCreated++;
      }

      modifierGroupIdMap.set(raw.id, canonicalGroupId);

      // ── Sync modifier options ─────────────────────────────────────────────
      const rawOptions = raw.options ?? [];
      for (const rawOpt of rawOptions) {
        try {
          // ── Mirror layer: upsert ChannelModifierOption ─────────────────────
          const channelOption = await prisma.channelModifierOption.upsert({
            where: { channel_externalId: { channel: ChannelType.LOYVERSE, externalId: rawOpt.id } },
            create: {
              channel: ChannelType.LOYVERSE,
              externalId: rawOpt.id,
              channelModifierGroupId: channelGroup.id,
              name: rawOpt.name,
              priceDelta: rawOpt.price,
              rawPayload: rawOpt as object,
              lastSyncedAt: syncedAt,
              isDeleted: false,
            },
            update: {
              name: rawOpt.name,
              priceDelta: rawOpt.price,
              rawPayload: rawOpt as object,
              lastSyncedAt: syncedAt,
              isDeleted: false,
            },
          });
          result.mirrorModifierOptionsUpserted++;

          // ── Mapping layer: find existing option mapping ────────────────────
          const existingOptionMapping = await prisma.modifierOptionChannelMapping.findUnique({
            where: { channelModifierOptionId: channelOption.id },
          });

          if (existingOptionMapping) {
            // ── Canonical: update existing option (Loyverse-owned fields) ───
            await prisma.productOption.update({
              where: { id: existingOptionMapping.modifierOptionId },
              data: {
                name: rawOpt.name,
                priceDelta: rawOpt.price,
                updatedAt: now(),
                // DO NOT overwrite soldOut, voiceAlias (Beyond-owned)
              },
            });
            await prisma.modifierOptionChannelMapping.update({
              where: { id: existingOptionMapping.id },
              data: { lastSyncAt: syncedAt, status: MappingStatus.ACTIVE },
            });
            result.canonicalModifierOptionsUpdated++;
          } else {
            // ── Canonical: create new canonical ProductOption ─────────────────
            const option = await prisma.productOption.create({
              data: {
                optionGroupId: canonicalGroupId,
                name: rawOpt.name,
                priceDelta: rawOpt.price,
                displayOrder: 0,
                isActive: true,
              },
            });
            result.canonicalModifierOptionsCreated++;

            // ── Mapping layer: create ModifierOptionChannelMapping ────────────
            await prisma.modifierOptionChannelMapping.create({
              data: {
                modifierOptionId: option.id,
                channel: ChannelType.LOYVERSE,
                channelModifierOptionId: channelOption.id,
                status: MappingStatus.ACTIVE,
                syncDirection: SyncDirection.PULL,
                lastMappedAt: syncedAt,
                lastSyncAt: syncedAt,
              },
            });
            result.modifierOptionMappingsCreated++;
          }
        } catch (err) {
          const msg = `[sync-modifiers] Error processing option ${rawOpt.id} in group ${raw.id}: ${err instanceof Error ? err.message : String(err)}`;
          console.error(msg);
          result.errors.push(msg);
          result.errorCount++;
        }
      }
    } catch (err) {
      const msg = `[sync-modifiers] Error processing modifier group ${raw.id}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(msg);
      result.errors.push(msg);
      result.errorCount++;
    }
  }

  return modifierGroupIdMap;
}

// ─── Step 3: Sync Products (Items) ───────────────────────────────────────────

/**
 * Upserts Loyverse items into the mirror layer, then creates or updates
 * canonical Product records and ProductChannelMapping records.
 *
 * Returns a map of Loyverse item external ID → canonical Product ID.
 */
async function syncMirrorProducts(
  activeItems: LoyverseRawItem[],
  categoryIdMap: Map<string, string>,
  result: LoyverseNewSyncResult
): Promise<Map<string, string>> {
  // Maps Loyverse item externalId → canonical productId
  const productIdMap = new Map<string, string>();
  const syncedAt = now();

  for (const raw of activeItems) {
    try {
      // Determine price from first variant (Loyverse stores price per variant)
      const price = raw.variants?.[0]?.default_price ?? null;

      // ── Mirror layer: upsert ChannelProduct ─────────────────────────────────
      const channelProduct = await prisma.channelProduct.upsert({
        where: { channel_externalId: { channel: ChannelType.LOYVERSE, externalId: raw.id } },
        create: {
          channel: ChannelType.LOYVERSE,
          externalId: raw.id,
          externalCategoryId: raw.category_id ?? null,
          name: raw.item_name,
          description: raw.description ?? null,
          price,
          sku: raw.reference_id ?? null,
          imageUrl: raw.image_url ?? null,
          rawPayload: raw as object,
          lastSyncedAt: syncedAt,
          isDeleted: false,
        },
        update: {
          externalCategoryId: raw.category_id ?? null,
          name: raw.item_name,
          description: raw.description ?? null,
          price,
          sku: raw.reference_id ?? null,
          imageUrl: raw.image_url ?? null,
          rawPayload: raw as object,
          lastSyncedAt: syncedAt,
          isDeleted: false,
        },
      });
      result.mirrorProductsUpserted++;

      // Resolve canonical category ID from the Loyverse category ID
      const canonicalCategoryId = raw.category_id
        ? (categoryIdMap.get(raw.category_id) ?? null)
        : null;

      // ── Mapping layer: find existing product mapping ─────────────────────────
      const existingProductMapping = await prisma.productChannelMapping.findUnique({
        where: { channelProductId: channelProduct.id },
      });

      let canonicalProductId: string;

      if (existingProductMapping) {
        // ── Canonical: update existing product (Loyverse-owned fields) ─────────
        // DO NOT overwrite: soldOut, voiceAlias, notes, isVisible (Beyond-owned)
        await prisma.product.update({
          where: { id: existingProductMapping.productId },
          data: {
            name: raw.item_name,
            description: raw.description ?? null,
            basePrice: price ?? 0,
            categoryId: canonicalCategoryId,
            imageUrl: raw.image_url ?? null,
            sku: raw.reference_id ?? null,
            updatedAt: now(),
          },
        });
        await prisma.productChannelMapping.update({
          where: { id: existingProductMapping.id },
          data: { lastSyncAt: syncedAt, status: MappingStatus.ACTIVE },
        });
        result.canonicalProductsUpdated++;
        canonicalProductId = existingProductMapping.productId;
      } else {
        // ── Canonical: create new canonical Product ──────────────────────────
        const slug = await ensureUniqueProductSlug(toSlug(raw.item_name));
        const product = await prisma.product.create({
          data: {
            name: raw.item_name,
            slug,
            description: raw.description ?? null,
            basePrice: price ?? 0,
            categoryId: canonicalCategoryId,
            imageUrl: raw.image_url ?? null,
            sku: raw.reference_id ?? null,
            isActive: true,
            isVisible: true,
            displayOrder: 0,
          },
        });
        result.canonicalProductsCreated++;
        canonicalProductId = product.id;

        // ── Mapping layer: create ProductChannelMapping ───────────────────────
        await prisma.productChannelMapping.create({
          data: {
            productId: canonicalProductId,
            channel: ChannelType.LOYVERSE,
            channelProductId: channelProduct.id,
            status: MappingStatus.ACTIVE,
            syncDirection: SyncDirection.PULL,
            lastMappedAt: syncedAt,
            lastSyncAt: syncedAt,
          },
        });
        result.productMappingsCreated++;
      }

      productIdMap.set(raw.id, canonicalProductId);
    } catch (err) {
      const msg = `[sync-products] Error processing item ${raw.id}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(msg);
      result.errors.push(msg);
      result.errorCount++;
    }
  }

  return productIdMap;
}

// ─── Step 4: Sync Product-Modifier Links ──────────────────────────────────────

/**
 * Rebuilds product-modifier-group links in both mirror and canonical layers.
 *
 * For each Loyverse item's modifier_ids:
 *   1. Find the ChannelModifierGroup by (channel=LOYVERSE, externalId=modifierId)
 *   2. Upsert ChannelProductModifierGroupLink in mirror layer
 *   3. Resolve canonical Product and ModifierGroup via mapping tables
 *   4. Upsert ProductOptionGroupAssignment in canonical layer
 *
 * Links that no longer exist in Loyverse are soft-deleted in the mirror layer.
 */
async function syncProductModifierLinks(
  activeItems: LoyverseRawItem[],
  result: LoyverseNewSyncResult
): Promise<void> {
  const syncedAt = now();

  for (const raw of activeItems) {
    if (!raw.modifier_ids?.length) continue;

    try {
      // Find the ChannelProduct for this item
      const channelProduct = await prisma.channelProduct.findUnique({
        where: { channel_externalId: { channel: ChannelType.LOYVERSE, externalId: raw.id } },
      });
      if (!channelProduct) continue;

      // Find canonical product via mapping
      const productMapping = await prisma.productChannelMapping.findUnique({
        where: { channelProductId: channelProduct.id },
      });
      if (!productMapping) continue;

      // Track which modifier group IDs are still active
      const activeModifierGroupIds = new Set<string>();

      for (const modifierId of raw.modifier_ids) {
        try {
          // Find the ChannelModifierGroup
          const channelGroup = await prisma.channelModifierGroup.findUnique({
            where: { channel_externalId: { channel: ChannelType.LOYVERSE, externalId: modifierId } },
          });
          if (!channelGroup) continue;

          activeModifierGroupIds.add(channelGroup.id);

          // ── Mirror layer: upsert ChannelProductModifierGroupLink ─────────────
          await prisma.channelProductModifierGroupLink.upsert({
            where: {
              channel_channelProductId_channelModifierGroupId: {
                channel: ChannelType.LOYVERSE,
                channelProductId: channelProduct.id,
                channelModifierGroupId: channelGroup.id,
              },
            },
            create: {
              channel: ChannelType.LOYVERSE,
              channelProductId: channelProduct.id,
              channelModifierGroupId: channelGroup.id,
              rawPayload: {},
              lastSyncedAt: syncedAt,
              isDeleted: false,
            },
            update: {
              rawPayload: {},
              lastSyncedAt: syncedAt,
              isDeleted: false,
            },
          });
          result.mirrorProductModifierLinksUpserted++;

          // ── Canonical layer: upsert ProductOptionGroupAssignment ─────────────
          const groupMapping = await prisma.modifierGroupChannelMapping.findUnique({
            where: { channelModifierGroupId: channelGroup.id },
          });
          if (!groupMapping) continue;

          await prisma.productOptionGroupAssignment.upsert({
            where: {
              productId_optionGroupId: {
                productId: productMapping.productId,
                optionGroupId: groupMapping.modifierGroupId,
              },
            },
            create: {
              productId: productMapping.productId,
              optionGroupId: groupMapping.modifierGroupId,
              displayOrder: 0,
              isRequired: false,
            },
            update: {
              updatedAt: now(),
            },
          });
          result.canonicalProductModifierLinksUpserted++;
        } catch (err) {
          const msg = `[sync-links] Error processing modifier link item=${raw.id} modifier=${modifierId}: ${err instanceof Error ? err.message : String(err)}`;
          console.error(msg);
          result.errors.push(msg);
          result.errorCount++;
        }
      }

      // ── Soft-delete mirror links that no longer exist in Loyverse ─────────────
      const staleLinks = await prisma.channelProductModifierGroupLink.findMany({
        where: {
          channel: ChannelType.LOYVERSE,
          channelProductId: channelProduct.id,
          isDeleted: false,
          channelModifierGroupId: { notIn: Array.from(activeModifierGroupIds) },
        },
      });

      if (staleLinks.length > 0) {
        await prisma.channelProductModifierGroupLink.updateMany({
          where: { id: { in: staleLinks.map((l) => l.id) } },
          data: { isDeleted: true, updatedAt: now() },
        });
        result.mirrorRecordsMarkedDeleted += staleLinks.length;
      }
    } catch (err) {
      const msg = `[sync-links] Error processing links for item ${raw.id}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(msg);
      result.errors.push(msg);
      result.errorCount++;
    }
  }
}

// ─── Step 5: Soft-delete stale mirror records ─────────────────────────────────

/**
 * Mark mirror records as isDeleted if they were not seen in the latest sync.
 * This implements soft-delete rather than hard delete for audit safety.
 */
async function markStaleRecordsDeleted(
  activeCategories: LoyverseRawCategory[],
  activeModifiers: LoyverseRawModifier[],
  activeItems: LoyverseRawItem[],
  result: LoyverseNewSyncResult
): Promise<void> {
  const activeCategoryExternalIds = new Set(activeCategories.map((c) => c.id));
  const activeModifierExternalIds = new Set(activeModifiers.map((m) => m.id));
  const activeItemExternalIds = new Set(activeItems.map((i) => i.id));

  // Soft-delete stale ChannelCategories
  const staleCategories = await prisma.channelCategory.findMany({
    where: {
      channel: ChannelType.LOYVERSE,
      isDeleted: false,
      externalId: { notIn: Array.from(activeCategoryExternalIds) },
    },
    select: { id: true },
  });
  if (staleCategories.length > 0) {
    await prisma.channelCategory.updateMany({
      where: { id: { in: staleCategories.map((c) => c.id) } },
      data: { isDeleted: true },
    });
    result.mirrorRecordsMarkedDeleted += staleCategories.length;
  }

  // Soft-delete stale ChannelModifierGroups
  const staleGroups = await prisma.channelModifierGroup.findMany({
    where: {
      channel: ChannelType.LOYVERSE,
      isDeleted: false,
      externalId: { notIn: Array.from(activeModifierExternalIds) },
    },
    select: { id: true },
  });
  if (staleGroups.length > 0) {
    await prisma.channelModifierGroup.updateMany({
      where: { id: { in: staleGroups.map((g) => g.id) } },
      data: { isDeleted: true },
    });
    result.mirrorRecordsMarkedDeleted += staleGroups.length;
  }

  // Soft-delete stale ChannelProducts
  const staleProducts = await prisma.channelProduct.findMany({
    where: {
      channel: ChannelType.LOYVERSE,
      isDeleted: false,
      externalId: { notIn: Array.from(activeItemExternalIds) },
    },
    select: { id: true },
  });
  if (staleProducts.length > 0) {
    await prisma.channelProduct.updateMany({
      where: { id: { in: staleProducts.map((p) => p.id) } },
      data: { isDeleted: true },
    });
    result.mirrorRecordsMarkedDeleted += staleProducts.length;
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Run a full Loyverse sync using the new 3-layer architecture:
 *   1. Mirror layer  — stores Loyverse data faithfully in channel_* tables
 *   2. Canonical layer — creates/updates canonical Beyond entities
 *   3. Mapping layer — links canonical to mirrored entities
 *
 * Product-modifier relationships are rebuilt from modifier_ids on each item.
 * Loyverse is authoritative for all structural data; Beyond-owned fields
 * (soldOut, voiceAlias, notes) are never overwritten.
 */
export async function runLoyverseNewFullSync(
  adapter: LoyverseAdapter
): Promise<LoyverseNewSyncResult> {
  const result: LoyverseNewSyncResult = {
    status: "success",
    startedAt: new Date(),
    mirrorCategoriesUpserted: 0,
    mirrorModifierGroupsUpserted: 0,
    mirrorModifierOptionsUpserted: 0,
    mirrorProductsUpserted: 0,
    mirrorProductModifierLinksUpserted: 0,
    mirrorRecordsMarkedDeleted: 0,
    canonicalCategoriesCreated: 0,
    canonicalCategoriesUpdated: 0,
    canonicalModifierGroupsCreated: 0,
    canonicalModifierGroupsUpdated: 0,
    canonicalModifierOptionsCreated: 0,
    canonicalModifierOptionsUpdated: 0,
    canonicalProductsCreated: 0,
    canonicalProductsUpdated: 0,
    canonicalProductModifierLinksUpserted: 0,
    categoryMappingsCreated: 0,
    productMappingsCreated: 0,
    modifierGroupMappingsCreated: 0,
    modifierOptionMappingsCreated: 0,
    errorCount: 0,
    errors: [],
  };

  // Create a SyncJob record for observability
  const syncJob = await prisma.syncJob.create({
    data: {
      channel: ChannelType.LOYVERSE,
      syncType: "FULL_PULL",
      status: "RUNNING",
    },
  });

  try {
    // ── Step 1: Fetch everything from Loyverse ─────────────────────────────────
    console.info("[new-full-sync] Fetching Loyverse catalog...");
    const raw = await adapter.fetchCatalog();

    const activeCategories = raw.categories.filter((c) => c.deleted_at === null);
    const activeModifiers = raw.modifiers.filter((m) => m.deleted_at === null);
    const activeItems = raw.items.filter((item) => item.deleted_at === null);

    console.info(
      `[new-full-sync] Fetched: categories=${activeCategories.length} ` +
        `modifiers=${activeModifiers.length} items=${activeItems.length}`
    );

    // ── Step 2: Sync categories (mirror → canonical → mapping) ────────────────
    console.info("[new-full-sync] Step 2: Syncing categories...");
    const categoryIdMap = await syncMirrorCategories(activeCategories, result);
    console.info(
      `[new-full-sync] Categories: mirror=${result.mirrorCategoriesUpserted} ` +
        `created=${result.canonicalCategoriesCreated} updated=${result.canonicalCategoriesUpdated}`
    );

    // ── Step 3: Sync modifier groups + options ────────────────────────────────
    console.info("[new-full-sync] Step 3: Syncing modifier groups...");
    await syncMirrorModifierGroups(activeModifiers, result);
    console.info(
      `[new-full-sync] Modifier groups: mirror=${result.mirrorModifierGroupsUpserted} ` +
        `created=${result.canonicalModifierGroupsCreated} updated=${result.canonicalModifierGroupsUpdated}`
    );

    // ── Step 4: Sync products ─────────────────────────────────────────────────
    console.info("[new-full-sync] Step 4: Syncing products...");
    await syncMirrorProducts(activeItems, categoryIdMap, result);
    console.info(
      `[new-full-sync] Products: mirror=${result.mirrorProductsUpserted} ` +
        `created=${result.canonicalProductsCreated} updated=${result.canonicalProductsUpdated}`
    );

    // ── Step 5: Sync product-modifier links ───────────────────────────────────
    console.info("[new-full-sync] Step 5: Syncing product-modifier links...");
    await syncProductModifierLinks(activeItems, result);
    console.info(
      `[new-full-sync] Links: mirror=${result.mirrorProductModifierLinksUpserted} ` +
        `canonical=${result.canonicalProductModifierLinksUpserted}`
    );

    // ── Step 6: Soft-delete stale mirror records ──────────────────────────────
    console.info("[new-full-sync] Step 6: Marking stale records as deleted...");
    await markStaleRecordsDeleted(activeCategories, activeModifiers, activeItems, result);
    console.info(`[new-full-sync] Stale records soft-deleted: ${result.mirrorRecordsMarkedDeleted}`);

    result.status = result.errorCount > 0 ? "partial" : "success";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[new-full-sync] Fatal error:", message);
    result.errors.push(message);
    result.errorCount++;
    result.status = "failed";
  }

  result.finishedAt = new Date();

  // Update the SyncJob record with the result
  await prisma.syncJob.update({
    where: { id: syncJob.id },
    data: {
      status: result.status.toUpperCase(),
      finishedAt: result.finishedAt,
      summary: {
        mirrorCategoriesUpserted: result.mirrorCategoriesUpserted,
        mirrorProductsUpserted: result.mirrorProductsUpserted,
        mirrorModifierGroupsUpserted: result.mirrorModifierGroupsUpserted,
        canonicalCategoriesCreated: result.canonicalCategoriesCreated,
        canonicalCategoriesUpdated: result.canonicalCategoriesUpdated,
        canonicalProductsCreated: result.canonicalProductsCreated,
        canonicalProductsUpdated: result.canonicalProductsUpdated,
        canonicalModifierGroupsCreated: result.canonicalModifierGroupsCreated,
        canonicalModifierGroupsUpdated: result.canonicalModifierGroupsUpdated,
        errorCount: result.errorCount,
      },
      errorMessage: result.errors.length > 0 ? result.errors.slice(0, 3).join("; ") : null,
    },
  });

  return result;
}
