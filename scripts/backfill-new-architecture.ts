#!/usr/bin/env npx ts-node --esm
// ─── Backfill Script: Migrate to New Product Architecture ────────────────────
// Migrates existing Loyverse-linked data from legacy tables into the new
// 3-layer architecture (mirror + canonical + mapping).
//
// This script is safe to run multiple times — it uses upsert operations.
//
// Steps:
//   1. Backfill LoyverseCategory → ChannelCategory + Category + CategoryChannelMapping
//   2. Backfill LoyverseModifier → ChannelModifierGroup + ModifierGroupChannelMapping
//   3. Backfill LoyverseModifierOption → ChannelModifierOption + ModifierOptionChannelMapping
//   4. Backfill LoyverseItem → ChannelProduct + ProductChannelMapping
//      (using ExternalProductMap to find the canonical Product)
//   5. Backfill LoyverseItemModifier → ChannelProductModifierGroupLink
//      + ProductOptionGroupAssignment (canonical link)
//   6. Backfill ExternalOptionGroupMap → ModifierGroupChannelMapping
//      (for existing ProductOptionGroup records)
//   7. Backfill ExternalOptionMap → ModifierOptionChannelMapping
//      (for existing ProductOption records)
//
// Run:
//   cd /home/runner/work/Beyond/Beyond
//   npx tsx scripts/backfill-new-architecture.ts
//
// Or with DATABASE_URL:
//   DATABASE_URL=<connection_string> npx tsx scripts/backfill-new-architecture.ts

// Use the same Prisma import pattern as the rest of the app
// Run this script with: cd <project-root> && npx tsx scripts/backfill-new-architecture.ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { ChannelType, MappingStatus, SyncDirection } from "../app/generated/prisma/enums";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? "",
    ssl: { rejectUnauthorized: false },
  }),
});

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureUniqueSlug(
  table: "category" | "product",
  baseSlug: string,
  existingId?: string
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing =
      table === "category"
        ? await prisma.category.findUnique({ where: { slug } })
        : await prisma.product.findUnique({ where: { slug } });
    if (!existing || existing.id === existingId) return slug;
    slug = `${baseSlug}-${counter++}`;
  }
}

const now = () => new Date();

async function backfillCategories(): Promise<number> {
  console.log("[backfill] Step 1: Backfilling LoyverseCategory → new architecture...");
  let count = 0;

  const loyverseCategories = await prisma.loyverseCategory.findMany({
    orderBy: { name: "asc" },
  });

  for (const lc of loyverseCategories) {
    try {
      const syncedAt = lc.updatedAt;

      // ── Mirror layer: upsert ChannelCategory ────────────────────────────────
      const channelCategory = await prisma.channelCategory.upsert({
        where: {
          channel_externalId: {
            channel: ChannelType.LOYVERSE,
            externalId: lc.loyverseCategoryId,
          },
        },
        create: {
          channel: ChannelType.LOYVERSE,
          externalId: lc.loyverseCategoryId,
          name: lc.name,
          isVisible: lc.isVisible,
          isActive: lc.isActive,
          displayOrder: lc.displayOrder,
          rawPayload: lc.rawPayload ?? { id: lc.loyverseCategoryId, name: lc.name },
          lastSyncedAt: syncedAt,
          isDeleted: !lc.isActive,
        },
        update: {
          name: lc.name,
          isVisible: lc.isVisible,
          isActive: lc.isActive,
          displayOrder: lc.displayOrder,
          rawPayload: lc.rawPayload ?? { id: lc.loyverseCategoryId, name: lc.name },
          lastSyncedAt: syncedAt,
        },
      });

      // ── Check for existing CategoryChannelMapping ────────────────────────────
      const existingMapping = await prisma.categoryChannelMapping.findUnique({
        where: {
          channelCategoryId: channelCategory.id,
        },
      });

      if (!existingMapping) {
        // ── Canonical layer: create new canonical Category ───────────────────
        const slug = await ensureUniqueSlug("category", toSlug(lc.name));
        const category = await prisma.category.create({
          data: {
            name: lc.name,
            slug,
            isActive: lc.isActive,
            isVisible: lc.isVisible,
            displayOrder: lc.displayOrder,
          },
        });

        // ── Mapping layer ────────────────────────────────────────────────────
        await prisma.categoryChannelMapping.create({
          data: {
            categoryId: category.id,
            channel: ChannelType.LOYVERSE,
            channelCategoryId: channelCategory.id,
            status: MappingStatus.ACTIVE,
            syncDirection: SyncDirection.PULL,
            lastMappedAt: now(),
            lastSyncAt: syncedAt,
          },
        });

        count++;
        console.log(`  [category] Migrated: ${lc.name} (${lc.loyverseCategoryId})`);
      }
    } catch (err) {
      console.error(`  [category] Error migrating ${lc.loyverseCategoryId}:`, err);
    }
  }

  console.log(`[backfill] Step 1 complete: ${count} categories migrated`);
  return count;
}

async function backfillModifiers(): Promise<number> {
  console.log("[backfill] Step 2: Backfilling LoyverseModifier → new architecture...");
  let count = 0;

  const loyverseModifiers = await prisma.loyverseModifier.findMany({
    include: { options: true },
  });

  for (const lm of loyverseModifiers) {
    try {
      // ── Mirror layer: upsert ChannelModifierGroup ────────────────────────────
      const channelGroup = await prisma.channelModifierGroup.upsert({
        where: {
          channel_externalId: {
            channel: ChannelType.LOYVERSE,
            externalId: lm.id,
          },
        },
        create: {
          channel: ChannelType.LOYVERSE,
          externalId: lm.id,
          name: lm.name,
          minSelect: lm.minSelect ?? null,
          maxSelect: lm.maxSelect ?? null,
          rawPayload: { id: lm.id, name: lm.name },
          lastSyncedAt: lm.updatedAt,
          isDeleted: false,
        },
        update: {
          name: lm.name,
          minSelect: lm.minSelect ?? null,
          maxSelect: lm.maxSelect ?? null,
          lastSyncedAt: lm.updatedAt,
        },
      });

      // ── Check for existing ExternalOptionGroupMap (legacy mapping) ───────────
      const legacyMapping = await prisma.externalOptionGroupMap.findFirst({
        where: { externalOptionGroupId: lm.id },
        include: { optionGroup: true },
      });

      let canonicalGroupId: string;

      if (legacyMapping) {
        // Use the existing canonical ProductOptionGroup
        canonicalGroupId = legacyMapping.optionGroupId;

        // Upsert the new mapping
        await prisma.modifierGroupChannelMapping.upsert({
          where: {
            channelModifierGroupId: channelGroup.id,
          },
          create: {
            modifierGroupId: canonicalGroupId,
            channel: ChannelType.LOYVERSE,
            channelModifierGroupId: channelGroup.id,
            status: MappingStatus.ACTIVE,
            syncDirection: SyncDirection.PULL,
            lastMappedAt: now(),
            lastSyncAt: lm.updatedAt,
          },
          update: {
            modifierGroupId: canonicalGroupId,
            lastSyncAt: lm.updatedAt,
          },
        });
      } else {
        // Check if ModifierGroupChannelMapping already exists
        const existingMapping = await prisma.modifierGroupChannelMapping.findUnique({
          where: {
            channelModifierGroupId: channelGroup.id,
          },
        });

        if (!existingMapping) {
          // Create new canonical group
          const group = await prisma.productOptionGroup.create({
            data: {
              name: lm.name,
              minSelect: lm.minSelect ?? 0,
              maxSelect: lm.maxSelect ?? 1,
              isRequired: lm.required,
              isActive: true,
              isVisible: true,
            },
          });
          canonicalGroupId = group.id;

          await prisma.modifierGroupChannelMapping.create({
            data: {
              modifierGroupId: canonicalGroupId,
              channel: ChannelType.LOYVERSE,
              channelModifierGroupId: channelGroup.id,
              status: MappingStatus.ACTIVE,
              syncDirection: SyncDirection.PULL,
              lastMappedAt: now(),
              lastSyncAt: lm.updatedAt,
            },
          });
          count++;
          console.log(`  [modifier] Created canonical group: ${lm.name} (${lm.id})`);
        } else {
          canonicalGroupId = existingMapping.modifierGroupId;
        }
      }

      // ── Backfill modifier options ────────────────────────────────────────────
      for (const lo of lm.options) {
        try {
          const channelOption = await prisma.channelModifierOption.upsert({
            where: {
              channel_externalId: {
                channel: ChannelType.LOYVERSE,
                externalId: lo.id,
              },
            },
            create: {
              channel: ChannelType.LOYVERSE,
              externalId: lo.id,
              channelModifierGroupId: channelGroup.id,
              name: lo.name,
              priceDelta: lo.price,
              rawPayload: { id: lo.id, name: lo.name, price: lo.price },
              lastSyncedAt: lo.updatedAt,
              isDeleted: false,
            },
            update: {
              name: lo.name,
              priceDelta: lo.price,
              lastSyncedAt: lo.updatedAt,
            },
          });

          // Check for legacy ExternalOptionMap
          const legacyOptionMap = await prisma.externalOptionMap.findFirst({
            where: { externalOptionId: lo.id },
          });

          if (legacyOptionMap) {
            await prisma.modifierOptionChannelMapping.upsert({
              where: {
                channelModifierOptionId: channelOption.id,
              },
              create: {
                modifierOptionId: legacyOptionMap.productOptionId,
                channel: ChannelType.LOYVERSE,
                channelModifierOptionId: channelOption.id,
                status: MappingStatus.ACTIVE,
                syncDirection: SyncDirection.PULL,
                lastMappedAt: now(),
                lastSyncAt: lo.updatedAt,
              },
              update: {
                modifierOptionId: legacyOptionMap.productOptionId,
                lastSyncAt: lo.updatedAt,
              },
            });
          } else {
            // Create new canonical option if no mapping exists yet
            const existingOptionMapping = await prisma.modifierOptionChannelMapping.findUnique({
              where: {
                channelModifierOptionId: channelOption.id,
              },
            });

            if (!existingOptionMapping) {
              const option = await prisma.productOption.create({
                data: {
                  optionGroupId: canonicalGroupId,
                  name: lo.name,
                  priceDelta: lo.price,
                  isActive: true,
                },
              });

              await prisma.modifierOptionChannelMapping.create({
                data: {
                  modifierOptionId: option.id,
                  channel: ChannelType.LOYVERSE,
                  channelModifierOptionId: channelOption.id,
                  status: MappingStatus.ACTIVE,
                  syncDirection: SyncDirection.PULL,
                  lastMappedAt: now(),
                  lastSyncAt: lo.updatedAt,
                },
              });
            }
          }
        } catch (err) {
          console.error(`  [modifier-option] Error migrating option ${lo.id}:`, err);
        }
      }
    } catch (err) {
      console.error(`  [modifier] Error migrating modifier ${lm.id}:`, err);
    }
  }

  console.log(`[backfill] Step 2 complete: ${count} modifier groups created`);
  return count;
}

async function backfillProducts(): Promise<number> {
  console.log("[backfill] Step 3: Backfilling LoyverseItem → new architecture...");
  let count = 0;

  const loyverseItems = await prisma.loyverseItem.findMany({
    include: { variants: true, modifiers: true },
  });

  for (const li of loyverseItems) {
    try {
      const price = li.price ?? null;

      // ── Mirror layer: upsert ChannelProduct ──────────────────────────────────
      const channelProduct = await prisma.channelProduct.upsert({
        where: {
          channel_externalId: {
            channel: ChannelType.LOYVERSE,
            externalId: li.id,
          },
        },
        create: {
          channel: ChannelType.LOYVERSE,
          externalId: li.id,
          externalCategoryId: li.categoryId ?? null,
          name: li.name,
          description: li.description ?? null,
          price,
          rawPayload: {
            id: li.id,
            name: li.name,
            description: li.description,
            category_id: li.categoryId,
            price,
          },
          lastSyncedAt: li.updatedAt,
          isDeleted: false,
        },
        update: {
          name: li.name,
          description: li.description ?? null,
          price,
          externalCategoryId: li.categoryId ?? null,
          lastSyncedAt: li.updatedAt,
        },
      });

      // ── Find canonical Product via legacy ExternalProductMap ─────────────────
      const legacyProductMap = await prisma.externalProductMap.findFirst({
        where: { externalProductId: li.id },
      });

      if (legacyProductMap) {
        // Upsert ProductChannelMapping
        await prisma.productChannelMapping.upsert({
          where: {
            channelProductId: channelProduct.id,
          },
          create: {
            productId: legacyProductMap.productId,
            channel: ChannelType.LOYVERSE,
            channelProductId: channelProduct.id,
            status: MappingStatus.ACTIVE,
            syncDirection: SyncDirection.PULL,
            lastMappedAt: now(),
            lastSyncAt: li.updatedAt,
          },
          update: {
            productId: legacyProductMap.productId,
            lastSyncAt: li.updatedAt,
          },
        });
        count++;
        console.log(`  [product] Mapped: ${li.name} (${li.id})`);
      } else {
        console.log(`  [product] No legacy mapping found for ${li.id} — skipping canonical`);
      }

      // ── Backfill item-modifier links ─────────────────────────────────────────
      for (const link of li.modifiers) {
        try {
          const channelGroup = await prisma.channelModifierGroup.findUnique({
            where: {
              channel_externalId: {
                channel: ChannelType.LOYVERSE,
                externalId: link.modifierId,
              },
            },
          });
          if (!channelGroup) continue;

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
              lastSyncedAt: li.updatedAt,
              isDeleted: false,
            },
            update: {
              lastSyncedAt: li.updatedAt,
            },
          });
        } catch (err) {
          console.error(`  [product-link] Error migrating link ${li.id}-${link.modifierId}:`, err);
        }
      }
    } catch (err) {
      console.error(`  [product] Error migrating item ${li.id}:`, err);
    }
  }

  console.log(`[backfill] Step 3 complete: ${count} products mapped`);
  return count;
}

async function backfillCategoryLinks(): Promise<void> {
  console.log("[backfill] Step 4: Linking canonical Products to canonical Categories...");
  let count = 0;

  // Find products that still use loyverseCategoryId but have no canonical categoryId
  const products = await prisma.product.findMany({
    where: { loyverseCategoryId: { not: null }, categoryId: null },
    select: { id: true, loyverseCategoryId: true },
  });

  for (const p of products) {
    if (!p.loyverseCategoryId) continue;

    // Find the canonical Category that was created from this LoyverseCategory
    const loyverseCat = await prisma.loyverseCategory.findUnique({
      where: { id: p.loyverseCategoryId },
      select: { loyverseCategoryId: true },
    });
    if (!loyverseCat) continue;

    const channelCat = await prisma.channelCategory.findUnique({
      where: {
        channel_externalId: {
          channel: ChannelType.LOYVERSE,
          externalId: loyverseCat.loyverseCategoryId,
        },
      },
      include: { channelMapping: { select: { categoryId: true } } },
    });
    if (!channelCat?.channelMapping?.categoryId) continue;

    await prisma.product.update({
      where: { id: p.id },
      data: { categoryId: channelCat.channelMapping.categoryId },
    });
    count++;
  }

  console.log(`[backfill] Step 4 complete: ${count} products linked to canonical categories`);
}

async function main() {
  console.log("=============================================================");
  console.log(" Backfill: Migrating to New Product Architecture");
  console.log("=============================================================\n");

  try {
    await backfillCategories();
    await backfillModifiers();
    await backfillProducts();
    await backfillCategoryLinks();

    console.log("\n=============================================================");
    console.log(" Backfill complete! Summary:");
    const categoryCount = await prisma.category.count();
    const channelCatCount = await prisma.channelCategory.count();
    const channelProdCount = await prisma.channelProduct.count();
    const channelGroupCount = await prisma.channelModifierGroup.count();
    const mappingCatCount = await prisma.categoryChannelMapping.count();
    const mappingProdCount = await prisma.productChannelMapping.count();
    const mappingGroupCount = await prisma.modifierGroupChannelMapping.count();
    console.log(`  canonical categories:         ${categoryCount}`);
    console.log(`  channel categories (mirror):  ${channelCatCount}`);
    console.log(`  channel products (mirror):    ${channelProdCount}`);
    console.log(`  channel modifier groups:      ${channelGroupCount}`);
    console.log(`  category mappings:            ${mappingCatCount}`);
    console.log(`  product mappings:             ${mappingProdCount}`);
    console.log(`  modifier group mappings:      ${mappingGroupCount}`);
    console.log("=============================================================\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal backfill error:", err);
  process.exit(1);
});
