/**
 * Loyverse → Canonical Auto-Mapping Service
 *
 * DESIGN: auto-map from mirror to canonical
 * ─────────────────────────────────────────────────────────────────────────────
 * After the mirror-first sync populates channel_ tables, this service reads
 * those mirrored rows and creates (or updates) internal canonical entities
 * (Category, Item, ItemVariant, ModifierGroup, ModifierOption) plus the
 * shared mapping rows that bridge external ↔ internal namespaces.
 *
 * WHY MAPPING TABLES?
 * Canonical internal IDs are stable service-owned identifiers. Loyverse IDs
 * are external and opaque. The mapping tables (category_channel_mappings,
 * item_channel_mappings, etc.) are the ONLY place where external Loyverse IDs
 * are associated with canonical rows. Canonical tables never store Loyverse IDs.
 *
 * HOW item.modifier_ids BECOMES canonical item_modifier_groups:
 * 1. channel_item_modifier_group_links stores (channel_item_id, modifier_group_external_id)
 * 2. modifier_group_channel_mappings links canonical modifier_group_id → channel_modifier_group_id
 * 3. item_channel_mappings links canonical item_id → channel_item_id
 * 4. linkCanonicalItemModifierGroups() joins these three tables to produce
 *    item_modifier_groups (canonical item_id, canonical modifier_group_id)
 *
 * IDEMPOTENCY
 * Every create/update path checks for an existing mapping row first.
 * Re-running this function is safe — no duplicates are created.
 *
 * SOFT-DELETE BEHAVIOUR
 * If a mirrored row has external_deleted_at set, the canonical row is marked
 * is_active = false. Mapping rows are retained. No hard deletes.
 */

import { prisma } from "@/lib/db";
import { Channel, MappingStatus } from "@/app/generated/prisma/enums";

// ─── Result types ─────────────────────────────────────────────────────────────

export interface CanonicalMappingSummary {
  categories_mapped: number;
  modifier_groups_mapped: number;
  modifier_options_mapped: number;
  items_mapped: number;
  variants_mapped: number;
  item_modifier_group_links_created: number;
  warnings: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isActive(externalDeletedAt: Date | null | undefined): boolean {
  return externalDeletedAt == null;
}

// ─── Phase B.1 — Auto-map categories ─────────────────────────────────────────

export async function autoMapLoyverseCategories(): Promise<{
  mapped: number;
  warnings: string[];
}> {
  const warnings: string[] = [];
  let mapped = 0;

  const mirroredCategories = await prisma.channelCategory.findMany({
    where: { channel: Channel.LOYVERSE },
    include: { categoryChannelMappings: { where: { channel: Channel.LOYVERSE } } },
  });

  for (const mirrorCat of mirroredCategories) {
    try {
      const active = isActive(mirrorCat.externalDeletedAt);
      const existingMapping = mirrorCat.categoryChannelMappings[0];

      if (existingMapping) {
        // Update canonical category from mirror
        await prisma.category.update({
          where: { id: existingMapping.categoryId },
          data: {
            name: mirrorCat.name,
            color: mirrorCat.color ?? null,
            isActive: active,
          },
        });
      } else {
        // Create canonical category and mapping
        const canonical = await prisma.category.create({
          data: {
            name: mirrorCat.name,
            color: mirrorCat.color ?? null,
            sortOrder: 0,
            isVisible: true,
            isActive: active,
          },
        });

        await prisma.categoryChannelMapping.create({
          data: {
            categoryId: canonical.id,
            channel: Channel.LOYVERSE,
            channelCategoryId: mirrorCat.id,
            mappingStatus: MappingStatus.ACTIVE,
            isPrimary: true,
          },
        });
      }

      mapped++;
    } catch (err) {
      warnings.push(
        `category mirror ${mirrorCat.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { mapped, warnings };
}

// ─── Phase B.2 — Auto-map modifier groups and options ────────────────────────

export async function autoMapLoyverseModifierGroups(): Promise<{
  groups_mapped: number;
  options_mapped: number;
  warnings: string[];
}> {
  const warnings: string[] = [];
  let groups_mapped = 0;
  let options_mapped = 0;

  const mirroredGroups = await prisma.channelModifierGroup.findMany({
    where: { channel: Channel.LOYVERSE },
    include: {
      modifierGroupChannelMappings: { where: { channel: Channel.LOYVERSE } },
      channelModifierOptions: {
        where: { channel: Channel.LOYVERSE },
        include: {
          modifierOptionChannelMappings: { where: { channel: Channel.LOYVERSE } },
        },
      },
    },
  });

  for (const mirrorGroup of mirroredGroups) {
    try {
      const groupActive = isActive(mirrorGroup.externalDeletedAt);
      let canonicalGroupId: string;
      const existingGroupMapping = mirrorGroup.modifierGroupChannelMappings[0];

      if (existingGroupMapping) {
        canonicalGroupId = existingGroupMapping.modifierGroupId;
        await prisma.modifierGroup.update({
          where: { id: canonicalGroupId },
          data: {
            name: mirrorGroup.name,
            sortOrder: mirrorGroup.position ?? 0,
            isActive: groupActive,
          },
        });
      } else {
        const canonicalGroup = await prisma.modifierGroup.create({
          data: {
            name: mirrorGroup.name,
            description: null,
            minSelect: null,
            maxSelect: null,
            sortOrder: mirrorGroup.position ?? 0,
            isActive: groupActive,
          },
        });
        canonicalGroupId = canonicalGroup.id;

        await prisma.modifierGroupChannelMapping.create({
          data: {
            modifierGroupId: canonicalGroupId,
            channel: Channel.LOYVERSE,
            channelModifierGroupId: mirrorGroup.id,
            mappingStatus: MappingStatus.ACTIVE,
            isPrimary: true,
          },
        });
      }
      groups_mapped++;

      // Auto-map child options
      for (const mirrorOption of mirrorGroup.channelModifierOptions) {
        try {
          const optionActive = isActive(mirrorOption.externalDeletedAt);
          const existingOptionMapping = mirrorOption.modifierOptionChannelMappings[0];

          if (existingOptionMapping) {
            await prisma.modifierOption.update({
              where: { id: existingOptionMapping.modifierOptionId },
              data: {
                name: mirrorOption.name,
                priceDelta: mirrorOption.price ?? 0,
                sortOrder: mirrorOption.position ?? 0,
                isActive: optionActive,
              },
            });
          } else {
            const canonicalOption = await prisma.modifierOption.create({
              data: {
                modifierGroupId: canonicalGroupId,
                name: mirrorOption.name,
                priceDelta: mirrorOption.price ?? 0,
                sortOrder: mirrorOption.position ?? 0,
                isDefault: false,
                isActive: optionActive,
              },
            });

            await prisma.modifierOptionChannelMapping.create({
              data: {
                modifierOptionId: canonicalOption.id,
                channel: Channel.LOYVERSE,
                channelModifierOptionId: mirrorOption.id,
                mappingStatus: MappingStatus.ACTIVE,
                isPrimary: true,
              },
            });
          }
          options_mapped++;
        } catch (err) {
          warnings.push(
            `modifier option mirror ${mirrorOption.id}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    } catch (err) {
      warnings.push(
        `modifier group mirror ${mirrorGroup.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { groups_mapped, options_mapped, warnings };
}

// ─── Phase B.3 — Auto-map items ──────────────────────────────────────────────

export async function autoMapLoyverseItems(): Promise<{ mapped: number; warnings: string[] }> {
  const warnings: string[] = [];
  let mapped = 0;

  const mirroredItems = await prisma.channelItem.findMany({
    where: { channel: Channel.LOYVERSE },
    include: {
      itemChannelMappings: { where: { channel: Channel.LOYVERSE } },
      channelCategory: {
        include: {
          categoryChannelMappings: { where: { channel: Channel.LOYVERSE } },
        },
      },
    },
  });

  for (const mirrorItem of mirroredItems) {
    try {
      const active = isActive(mirrorItem.externalDeletedAt);

      // Resolve canonical category
      let canonicalCategoryId: string | null = null;
      if (mirrorItem.channelCategory) {
        const catMapping = mirrorItem.channelCategory.categoryChannelMappings[0];
        if (catMapping) {
          canonicalCategoryId = catMapping.categoryId;
        } else {
          warnings.push(
            `item mirror ${mirrorItem.id}: channel category ${mirrorItem.channelCategoryId} has no canonical mapping`
          );
        }
      }

      const existingMapping = mirrorItem.itemChannelMappings[0];

      if (existingMapping) {
        await prisma.item.update({
          where: { id: existingMapping.itemId },
          data: {
            categoryId: canonicalCategoryId,
            name: mirrorItem.itemName,
            description: mirrorItem.description ?? null,
            sku: mirrorItem.referenceId ?? null,
            trackStock: mirrorItem.trackStock,
            soldByWeight: mirrorItem.soldByWeight,
            isComposite: mirrorItem.isComposite,
            useProduction: mirrorItem.useProduction,
            form: mirrorItem.form ?? null,
            color: mirrorItem.color ?? null,
            imageUrl: mirrorItem.imageUrl ?? null,
            isActive: active,
          },
        });
      } else {
        const canonicalItem = await prisma.item.create({
          data: {
            categoryId: canonicalCategoryId,
            name: mirrorItem.itemName,
            description: mirrorItem.description ?? null,
            sku: mirrorItem.referenceId ?? null,
            basePrice: null,
            trackStock: mirrorItem.trackStock,
            soldByWeight: mirrorItem.soldByWeight,
            isComposite: mirrorItem.isComposite,
            useProduction: mirrorItem.useProduction,
            form: mirrorItem.form ?? null,
            color: mirrorItem.color ?? null,
            imageUrl: mirrorItem.imageUrl ?? null,
            sortOrder: 0,
            isVisible: true,
            isActive: active,
          },
        });

        await prisma.itemChannelMapping.create({
          data: {
            itemId: canonicalItem.id,
            channel: Channel.LOYVERSE,
            channelItemId: mirrorItem.id,
            mappingStatus: MappingStatus.ACTIVE,
            isPrimary: true,
          },
        });
      }

      mapped++;
    } catch (err) {
      warnings.push(
        `item mirror ${mirrorItem.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { mapped, warnings };
}

// ─── Phase B.4 — Auto-map variants ───────────────────────────────────────────

export async function autoMapLoyverseVariants(): Promise<{ mapped: number; warnings: string[] }> {
  const warnings: string[] = [];
  let mapped = 0;

  const mirroredVariants = await prisma.channelVariant.findMany({
    where: { channel: Channel.LOYVERSE },
    include: {
      itemVariantChannelMappings: { where: { channel: Channel.LOYVERSE } },
      channelItem: {
        include: {
          itemChannelMappings: { where: { channel: Channel.LOYVERSE } },
          channelVariants: { where: { channel: Channel.LOYVERSE } },
        },
      },
      channelVariantStoreData: { where: { channel: Channel.LOYVERSE } },
    },
  });

  for (const mirrorVariant of mirroredVariants) {
    try {
      const active = isActive(mirrorVariant.externalDeletedAt);

      // Resolve parent canonical item
      const itemMapping = mirrorVariant.channelItem?.itemChannelMappings[0];
      if (!itemMapping) {
        warnings.push(
          `variant mirror ${mirrorVariant.id}: parent item has no canonical mapping — skipping`
        );
        continue;
      }
      const canonicalItemId = itemMapping.itemId;

      // Derive variant name from option values
      const optionParts = [
        mirrorVariant.option1Value,
        mirrorVariant.option2Value,
        mirrorVariant.option3Value,
      ].filter((v): v is string => v != null && v.trim() !== "");
      const variantName =
        optionParts.length > 0
          ? optionParts.join(" / ")
          : mirrorVariant.channelItem?.itemName ?? "Default";

      // Resolve price: prefer single active store price, then default_price
      const storeRows = mirrorVariant.channelVariantStoreData;
      const activeStoreRows = storeRows.filter((s) => s.price != null);
      let resolvedPrice = null as typeof activeStoreRows[0]["price"] | null;
      if (activeStoreRows.length === 1) {
        resolvedPrice = activeStoreRows[0].price;
      } else if (mirrorVariant.defaultPrice != null) {
        resolvedPrice = mirrorVariant.defaultPrice;
      }

      // Determine if this is the only active variant (isDefault)
      const activeVariants = mirrorVariant.channelItem?.channelVariants.filter(
        (v) => v.externalDeletedAt == null
      ) ?? [];
      const isDefault = activeVariants.length <= 1;

      const existingMapping = mirrorVariant.itemVariantChannelMappings[0];

      if (existingMapping) {
        await prisma.itemVariant.update({
          where: { id: existingMapping.itemVariantId },
          data: {
            name: variantName,
            sku: mirrorVariant.sku ?? null,
            barcode: mirrorVariant.barcode ?? null,
            price: resolvedPrice,
            cost: mirrorVariant.cost ?? null,
            purchaseCost: mirrorVariant.purchaseCost ?? null,
            option1Value: mirrorVariant.option1Value ?? null,
            option2Value: mirrorVariant.option2Value ?? null,
            option3Value: mirrorVariant.option3Value ?? null,
            isDefault,
            isActive: active,
          },
        });
      } else {
        const canonicalVariant = await prisma.itemVariant.create({
          data: {
            itemId: canonicalItemId,
            name: variantName,
            sku: mirrorVariant.sku ?? null,
            barcode: mirrorVariant.barcode ?? null,
            price: resolvedPrice,
            cost: mirrorVariant.cost ?? null,
            purchaseCost: mirrorVariant.purchaseCost ?? null,
            option1Value: mirrorVariant.option1Value ?? null,
            option2Value: mirrorVariant.option2Value ?? null,
            option3Value: mirrorVariant.option3Value ?? null,
            sortOrder: 0,
            isDefault,
            isActive: active,
          },
        });

        await prisma.itemVariantChannelMapping.create({
          data: {
            itemVariantId: canonicalVariant.id,
            channel: Channel.LOYVERSE,
            channelVariantId: mirrorVariant.id,
            mappingStatus: MappingStatus.ACTIVE,
            isPrimary: true,
          },
        });
      }

      mapped++;
    } catch (err) {
      warnings.push(
        `variant mirror ${mirrorVariant.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { mapped, warnings };
}

// ─── Phase B.5 — Link canonical item modifier groups ─────────────────────────
// Derives canonical item_modifier_groups from channel_item_modifier_group_links.
// Joins mirror links → modifier_group_channel_mappings → item_channel_mappings.

export async function linkCanonicalItemModifierGroups(): Promise<{
  links_created: number;
  warnings: string[];
}> {
  const warnings: string[] = [];
  let links_created = 0;

  // Fetch all LOYVERSE item-modifier-group links from mirror
  const mirrorLinks = await prisma.channelItemModifierGroupLink.findMany({
    where: { channel: Channel.LOYVERSE },
    include: {
      channelItem: {
        include: {
          itemChannelMappings: { where: { channel: Channel.LOYVERSE } },
        },
      },
    },
  });

  for (const link of mirrorLinks) {
    try {
      // Resolve canonical item
      const itemMapping = link.channelItem?.itemChannelMappings[0];
      if (!itemMapping) {
        warnings.push(
          `item modifier link (channelItemId=${link.channelItemId}): canonical item not found — skipping`
        );
        continue;
      }
      const canonicalItemId = itemMapping.itemId;

      // Resolve canonical modifier group via mirror external id
      const mirrorModGroup = await prisma.channelModifierGroup.findUnique({
        where: {
          channel_externalId: {
            channel: Channel.LOYVERSE,
            externalId: link.channelModifierGroupExternalId,
          },
        },
        include: {
          modifierGroupChannelMappings: { where: { channel: Channel.LOYVERSE } },
        },
      });

      if (!mirrorModGroup) {
        warnings.push(
          `item modifier link (channelItemId=${link.channelItemId}): mirror modifier group ${link.channelModifierGroupExternalId} not found — skipping`
        );
        continue;
      }

      const groupMapping = mirrorModGroup.modifierGroupChannelMappings[0];
      if (!groupMapping) {
        warnings.push(
          `item modifier link (channelItemId=${link.channelItemId}): modifier group ${link.channelModifierGroupExternalId} has no canonical mapping — skipping`
        );
        continue;
      }
      const canonicalModifierGroupId = groupMapping.modifierGroupId;

      // Upsert canonical item_modifier_groups link
      await prisma.itemModifierGroup.upsert({
        where: {
          itemId_modifierGroupId: {
            itemId: canonicalItemId,
            modifierGroupId: canonicalModifierGroupId,
          },
        },
        create: {
          itemId: canonicalItemId,
          modifierGroupId: canonicalModifierGroupId,
          sortOrder: 0,
          isRequired: false,
        },
        update: {},
      });
      links_created++;
    } catch (err) {
      warnings.push(
        `item modifier link (channelItemId=${link.channelItemId}, modGroupExternalId=${link.channelModifierGroupExternalId}): ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { links_created, warnings };
}

// ─── Phase B — Main orchestrator ──────────────────────────────────────────────

export async function autoMapLoyverseCatalogToCanonical(): Promise<CanonicalMappingSummary> {
  const warnings: string[] = [];

  // 1. Categories
  const catResult = await autoMapLoyverseCategories();
  warnings.push(...catResult.warnings);

  // 2. Modifier groups and options
  const modResult = await autoMapLoyverseModifierGroups();
  warnings.push(...modResult.warnings);

  // 3. Items
  const itemResult = await autoMapLoyverseItems();
  warnings.push(...itemResult.warnings);

  // 4. Variants
  const variantResult = await autoMapLoyverseVariants();
  warnings.push(...variantResult.warnings);

  // 5. Item → modifier group links
  const linkResult = await linkCanonicalItemModifierGroups();
  warnings.push(...linkResult.warnings);

  return {
    categories_mapped: catResult.mapped,
    modifier_groups_mapped: modResult.groups_mapped,
    modifier_options_mapped: modResult.options_mapped,
    items_mapped: itemResult.mapped,
    variants_mapped: variantResult.mapped,
    item_modifier_group_links_created: linkResult.links_created,
    warnings,
  };
}
