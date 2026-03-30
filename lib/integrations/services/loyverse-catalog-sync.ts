/**
 * Loyverse Catalog Mirror Sync
 *
 * Populates the shared channel mirror tables from the Loyverse API.
 * Only the channel_ mirror layer is written here — internal canonical
 * tables (categories, items, item_variants, etc.) are NOT touched.
 */

import { prisma } from "@/lib/db";
import { Channel } from "@/app/generated/prisma/enums";
import type { LoyverseAdapter } from "../adapters/pos/loyverse";

export interface CatalogSyncResult {
  status: "success" | "partial" | "failed";
  startedAt: Date;
  finishedAt: Date;
  categoriesSynced: number;
  itemsSynced: number;
  variantsSynced: number;
  modifierGroupsSynced: number;
  modifierOptionsSynced: number;
  paymentTypesSynced: number;
  errors: string[];
}

export async function syncLoyverseCatalog(adapter: LoyverseAdapter): Promise<CatalogSyncResult> {
  const startedAt = new Date();
  const errors: string[] = [];
  let categoriesSynced = 0;
  let itemsSynced = 0;
  let variantsSynced = 0;
  let modifierGroupsSynced = 0;
  let modifierOptionsSynced = 0;
  let paymentTypesSynced = 0;

  const syncJob = await prisma.syncJob.create({
    data: { channel: Channel.LOYVERSE, syncType: "CATALOG_PULL", status: "RUNNING" },
  });

  try {
    // 1. Sync categories
    const catResult = await adapter.fetchRawCategories();
    if (catResult.success && catResult.data) {
      for (const cat of catResult.data) {
        await prisma.channelCategory.upsert({
          where: { channel_externalId: { channel: Channel.LOYVERSE, externalId: cat.id } },
          create: {
            channel: Channel.LOYVERSE,
            externalId: cat.id,
            name: cat.name,
            color: cat.color ?? null,
            externalDeletedAt: cat.deleted_at ? new Date(cat.deleted_at) : null,
            rawPayload: cat as object,
            syncedAt: new Date(),
          },
          update: {
            name: cat.name,
            color: cat.color ?? null,
            externalDeletedAt: cat.deleted_at ? new Date(cat.deleted_at) : null,
            rawPayload: cat as object,
            syncedAt: new Date(),
          },
        });
        categoriesSynced++;
      }
    }

    // 2. Sync modifier groups and options
    const modResult = await adapter.fetchRawModifiers();
    if (modResult.success && modResult.data) {
      for (const mod of modResult.data) {
        const channelModGroup = await prisma.channelModifierGroup.upsert({
          where: { channel_externalId: { channel: Channel.LOYVERSE, externalId: mod.id } },
          create: {
            channel: Channel.LOYVERSE,
            externalId: mod.id,
            name: mod.name,
            externalCreatedAt: mod.created_at ? new Date(mod.created_at) : null,
            externalUpdatedAt: mod.updated_at ? new Date(mod.updated_at) : null,
            externalDeletedAt: mod.deleted_at ? new Date(mod.deleted_at) : null,
            rawPayload: mod as object,
            syncedAt: new Date(),
          },
          update: {
            name: mod.name,
            externalUpdatedAt: mod.updated_at ? new Date(mod.updated_at) : null,
            externalDeletedAt: mod.deleted_at ? new Date(mod.deleted_at) : null,
            rawPayload: mod as object,
            syncedAt: new Date(),
          },
        });
        modifierGroupsSynced++;

        for (const opt of mod.options ?? []) {
          await prisma.channelModifierOption.upsert({
            where: { channel_externalId: { channel: Channel.LOYVERSE, externalId: opt.id } },
            create: {
              channel: Channel.LOYVERSE,
              externalId: opt.id,
              channelModifierGroupId: channelModGroup.id,
              name: opt.name,
              price: opt.price ?? null,
              rawPayload: opt as object,
              syncedAt: new Date(),
            },
            update: {
              name: opt.name,
              price: opt.price ?? null,
              rawPayload: opt as object,
              syncedAt: new Date(),
            },
          });
          modifierOptionsSynced++;
        }
      }
    }

    // 3. Sync items and variants
    const itemsResult = await adapter.fetchRawItems();
    if (itemsResult.success && itemsResult.data) {
      for (const item of itemsResult.data) {
        let channelCategoryId: string | null = null;
        if (item.category_id) {
          const chanCat = await prisma.channelCategory.findUnique({
            where: { channel_externalId: { channel: Channel.LOYVERSE, externalId: item.category_id } },
          });
          channelCategoryId = chanCat?.id ?? null;
        }

        const firstVariant = item.variants?.[0];
        const channelItem = await prisma.channelItem.upsert({
          where: { channel_externalId: { channel: Channel.LOYVERSE, externalId: item.id } },
          create: {
            channel: Channel.LOYVERSE,
            externalId: item.id,
            channelCategoryId,
            itemName: item.item_name,
            description: item.description ?? null,
            referenceId: item.reference_id ?? null,
            trackStock: false,
            soldByWeight: item.sold_by_weight ?? false,
            isComposite: item.is_composite ?? false,
            useProduction: false,
            form: item.form ?? null,
            color: item.color ?? null,
            imageUrl: item.image_url ?? null,
            option1Name: firstVariant?.option1_name ?? null,
            option2Name: firstVariant?.option2_name ?? null,
            option3Name: firstVariant?.option3_name ?? null,
            externalCreatedAt: item.created_at ? new Date(item.created_at) : null,
            externalUpdatedAt: item.updated_at ? new Date(item.updated_at) : null,
            externalDeletedAt: item.deleted_at ? new Date(item.deleted_at) : null,
            rawPayload: item as object,
            syncedAt: new Date(),
          },
          update: {
            channelCategoryId,
            itemName: item.item_name,
            description: item.description ?? null,
            referenceId: item.reference_id ?? null,
            soldByWeight: item.sold_by_weight ?? false,
            isComposite: item.is_composite ?? false,
            form: item.form ?? null,
            color: item.color ?? null,
            imageUrl: item.image_url ?? null,
            externalUpdatedAt: item.updated_at ? new Date(item.updated_at) : null,
            externalDeletedAt: item.deleted_at ? new Date(item.deleted_at) : null,
            rawPayload: item as object,
            syncedAt: new Date(),
          },
        });
        itemsSynced++;

        // Sync modifier group links
        await prisma.channelItemModifierGroupLink.deleteMany({
          where: { channel: Channel.LOYVERSE, channelItemId: channelItem.id },
        });
        for (const modId of item.modifier_ids ?? []) {
          await prisma.channelItemModifierGroupLink.upsert({
            where: {
              channel_channelItemId_channelModifierGroupExternalId: {
                channel: Channel.LOYVERSE,
                channelItemId: channelItem.id,
                channelModifierGroupExternalId: modId,
              },
            },
            create: {
              channel: Channel.LOYVERSE,
              channelItemId: channelItem.id,
              channelModifierGroupExternalId: modId,
            },
            update: {},
          });
        }

        // Sync variants
        for (const variant of item.variants ?? []) {
          const channelVariant = await prisma.channelVariant.upsert({
            where: { channel_externalId: { channel: Channel.LOYVERSE, externalId: variant.variant_id } },
            create: {
              channel: Channel.LOYVERSE,
              externalId: variant.variant_id,
              channelItemId: channelItem.id,
              sku: variant.sku ?? null,
              referenceVariantId: variant.reference_id ?? null,
              option1Value: variant.option1_val ?? null,
              option2Value: variant.option2_val ?? null,
              option3Value: variant.option3_val ?? null,
              barcode: variant.barcode ?? null,
              cost: variant.cost ?? null,
              defaultPricingType: variant.default_pricing_type ?? null,
              defaultPrice: variant.default_price ?? null,
              externalUpdatedAt: variant.updated_at ? new Date(variant.updated_at) : null,
              rawPayload: variant as object,
              syncedAt: new Date(),
            },
            update: {
              sku: variant.sku ?? null,
              option1Value: variant.option1_val ?? null,
              option2Value: variant.option2_val ?? null,
              option3Value: variant.option3_val ?? null,
              barcode: variant.barcode ?? null,
              cost: variant.cost ?? null,
              defaultPricingType: variant.default_pricing_type ?? null,
              defaultPrice: variant.default_price ?? null,
              externalUpdatedAt: variant.updated_at ? new Date(variant.updated_at) : null,
              rawPayload: variant as object,
              syncedAt: new Date(),
            },
          });
          variantsSynced++;

          for (const store of variant.stores ?? []) {
            await prisma.channelVariantStoreData.upsert({
              where: {
                channel_channelVariantId_storeExternalId: {
                  channel: Channel.LOYVERSE,
                  channelVariantId: channelVariant.id,
                  storeExternalId: store.store_id,
                },
              },
              create: {
                channel: Channel.LOYVERSE,
                channelVariantId: channelVariant.id,
                storeExternalId: store.store_id,
                pricingType: store.pricing_type ?? null,
                price: store.price ?? null,
                availableForSale: store.available_for_sale ?? null,
                rawPayload: store as object,
              },
              update: {
                pricingType: store.pricing_type ?? null,
                price: store.price ?? null,
                availableForSale: store.available_for_sale ?? null,
                rawPayload: store as object,
              },
            });
          }
        }
      }
    }

    // 4. Sync payment types
    const ptResult = await adapter.fetchRawPaymentTypes();
    if (ptResult.success && ptResult.data) {
      for (const pt of ptResult.data) {
        const channelPt = await prisma.channelPaymentType.upsert({
          where: { channel_externalId: { channel: Channel.LOYVERSE, externalId: pt.id } },
          create: {
            channel: Channel.LOYVERSE,
            externalId: pt.id,
            name: pt.name,
            paymentTypeCode: pt.type ?? null,
            externalCreatedAt: pt.created_at ? new Date(pt.created_at) : null,
            externalUpdatedAt: pt.updated_at ? new Date(pt.updated_at) : null,
            externalDeletedAt: pt.deleted_at ? new Date(pt.deleted_at) : null,
            rawPayload: pt as object,
            syncedAt: new Date(),
          },
          update: {
            name: pt.name,
            paymentTypeCode: pt.type ?? null,
            externalDeletedAt: pt.deleted_at ? new Date(pt.deleted_at) : null,
            rawPayload: pt as object,
            syncedAt: new Date(),
          },
        });
        paymentTypesSynced++;

        for (const store of pt.stores ?? []) {
          await prisma.channelPaymentTypeStoreLink.upsert({
            where: {
              channel_channelPaymentTypeId_storeExternalId: {
                channel: Channel.LOYVERSE,
                channelPaymentTypeId: channelPt.id,
                storeExternalId: store.store_id,
              },
            },
            create: {
              channel: Channel.LOYVERSE,
              channelPaymentTypeId: channelPt.id,
              storeExternalId: store.store_id,
            },
            update: {},
          });
        }
      }
    }

    const finishedAt = new Date();
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: errors.length > 0 ? "PARTIAL" : "SUCCESS",
        finishedAt,
        summary: { categoriesSynced, itemsSynced, variantsSynced, modifierGroupsSynced, modifierOptionsSynced, paymentTypesSynced, errors },
      },
    });

    return { status: errors.length > 0 ? "partial" : "success", startedAt, finishedAt, categoriesSynced, itemsSynced, variantsSynced, modifierGroupsSynced, modifierOptionsSynced, paymentTypesSynced, errors };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    errors.push(errorMessage);
    const finishedAt = new Date();
    await prisma.syncJob.update({ where: { id: syncJob.id }, data: { status: "FAILED", finishedAt, errorMessage } });
    return { status: "failed", startedAt, finishedAt, categoriesSynced, itemsSynced, variantsSynced, modifierGroupsSynced, modifierOptionsSynced, paymentTypesSynced, errors };
  }
}
