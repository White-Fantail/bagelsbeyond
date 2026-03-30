/**
 * Loyverse Catalog Mirror-First Sync
 *
 * DESIGN: mirror-first sync
 * ─────────────────────────────────────────────────────────────────────────────
 * All Loyverse data is first written into shared channel mirror tables
 * (channel_categories, channel_items, channel_variants, etc.) before any
 * canonical internal tables are touched. This keeps external IDs strictly
 * separated from internal canonical PKs, and allows multiple channels to
 * map onto the same canonical entities through shared mapping tables.
 *
 * WHY SHARED CHANNEL TABLES?
 * Using channel_ prefixed tables (not per-channel tables) lets a single schema
 * represent multiple POS/delivery channels without duplicating table structures.
 * Every row carries a `channel` discriminator column.
 *
 * WHY SEPARATE INTERNAL IDs FROM EXTERNAL IDs?
 * Loyverse IDs are opaque external strings that can change or be reused if an
 * account is migrated. Internal canonical IDs (cuid) are owned by this service
 * and never exposed to Loyverse. Mapping tables bridge the two namespaces.
 *
 * SYNC ORDER
 * 1. categories   — no upstream dependencies
 * 2. modifiers    — no upstream dependencies
 * 3. payment types — no upstream dependencies
 * 4. items + variants — depend on categories being mirrored first
 * 5. link reconciliation (item modifier/tax/component links)
 */

import { prisma } from "@/lib/db";
import { Channel } from "@/app/generated/prisma/enums";
import type { LoyverseAdapter } from "../adapters/pos/loyverse";

// ─── Result types ─────────────────────────────────────────────────────────────

export interface MirrorSyncSummary {
  categories_upserted: number;
  modifier_groups_upserted: number;
  modifier_options_upserted: number;
  payment_types_upserted: number;
  items_upserted: number;
  variants_upserted: number;
  component_links_synced: number;
  item_tax_links_synced: number;
  item_modifier_links_synced: number;
  variant_store_rows_synced: number;
  warnings: string[];
  errors: string[];
}

// ─── Phase A — Category mirror sync ──────────────────────────────────────────

export async function syncLoyverseCategories(
  adapter: LoyverseAdapter
): Promise<{ upserted: number; warnings: string[] }> {
  const warnings: string[] = [];
  let upserted = 0;

  const result = await adapter.fetchRawCategories();
  if (!result.success || !result.data) {
    warnings.push(`fetchRawCategories failed: ${result.error ?? "unknown error"}`);
    return { upserted, warnings };
  }

  for (const cat of result.data) {
    try {
      const now = new Date();
      await prisma.channelCategory.upsert({
        where: { channel_externalId: { channel: Channel.LOYVERSE, externalId: cat.id } },
        create: {
          channel: Channel.LOYVERSE,
          externalId: cat.id,
          name: cat.name,
          color: cat.color ?? null,
          externalCreatedAt: null,
          externalUpdatedAt: null,
          externalDeletedAt: cat.deleted_at ? new Date(cat.deleted_at) : null,
          rawPayload: cat as object,
          syncedAt: now,
        },
        update: {
          name: cat.name,
          color: cat.color ?? null,
          externalDeletedAt: cat.deleted_at ? new Date(cat.deleted_at) : null,
          rawPayload: cat as object,
          syncedAt: now,
        },
      });
      upserted++;
    } catch (err) {
      warnings.push(`category ${cat.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { upserted, warnings };
}

// ─── Phase A — Modifier mirror sync ──────────────────────────────────────────

export async function syncLoyverseModifiers(
  adapter: LoyverseAdapter
): Promise<{ groups_upserted: number; options_upserted: number; warnings: string[] }> {
  const warnings: string[] = [];
  let groups_upserted = 0;
  let options_upserted = 0;

  const result = await adapter.fetchRawModifiers();
  if (!result.success || !result.data) {
    warnings.push(`fetchRawModifiers failed: ${result.error ?? "unknown error"}`);
    return { groups_upserted, options_upserted, warnings };
  }

  for (const mod of result.data) {
    try {
      const now = new Date();

      // Upsert modifier group
      const channelModGroup = await prisma.channelModifierGroup.upsert({
        where: { channel_externalId: { channel: Channel.LOYVERSE, externalId: mod.id } },
        create: {
          channel: Channel.LOYVERSE,
          externalId: mod.id,
          name: mod.name,
          position: mod.position ?? null,
          externalCreatedAt: mod.created_at ? new Date(mod.created_at) : null,
          externalUpdatedAt: mod.updated_at ? new Date(mod.updated_at) : null,
          externalDeletedAt: mod.deleted_at ? new Date(mod.deleted_at) : null,
          rawPayload: mod as object,
          syncedAt: now,
        },
        update: {
          name: mod.name,
          position: mod.position ?? null,
          externalUpdatedAt: mod.updated_at ? new Date(mod.updated_at) : null,
          externalDeletedAt: mod.deleted_at ? new Date(mod.deleted_at) : null,
          rawPayload: mod as object,
          syncedAt: now,
        },
      });
      groups_upserted++;

      // Reconcile store links
      const upstreamStoreIds = (mod.stores ?? []).map((s) => s.store_id);
      if (upstreamStoreIds.length > 0) {
        for (const storeId of upstreamStoreIds) {
          try {
            await prisma.channelModifierGroupStoreLink.upsert({
              where: {
                channel_channelModifierGroupId_storeExternalId: {
                  channel: Channel.LOYVERSE,
                  channelModifierGroupId: channelModGroup.id,
                  storeExternalId: storeId,
                },
              },
              create: {
                channel: Channel.LOYVERSE,
                channelModifierGroupId: channelModGroup.id,
                storeExternalId: storeId,
              },
              update: {},
            });
          } catch (err) {
            warnings.push(
              `modifier group ${mod.id} store link ${storeId}: ${err instanceof Error ? err.message : String(err)}`
            );
          }
        }
        // Remove stale store links
        await prisma.channelModifierGroupStoreLink.deleteMany({
          where: {
            channel: Channel.LOYVERSE,
            channelModifierGroupId: channelModGroup.id,
            storeExternalId: { notIn: upstreamStoreIds },
          },
        });
      }

      // Upsert modifier options
      for (const opt of mod.options ?? []) {
        try {
          await prisma.channelModifierOption.upsert({
            where: { channel_externalId: { channel: Channel.LOYVERSE, externalId: opt.id } },
            create: {
              channel: Channel.LOYVERSE,
              externalId: opt.id,
              channelModifierGroupId: channelModGroup.id,
              name: opt.name,
              price: opt.price ?? null,
              position: opt.position ?? null,
              externalCreatedAt: opt.created_at ? new Date(opt.created_at) : null,
              externalUpdatedAt: opt.updated_at ? new Date(opt.updated_at) : null,
              externalDeletedAt: opt.deleted_at ? new Date(opt.deleted_at) : null,
              rawPayload: opt as object,
              syncedAt: now,
            },
            update: {
              name: opt.name,
              price: opt.price ?? null,
              position: opt.position ?? null,
              externalUpdatedAt: opt.updated_at ? new Date(opt.updated_at) : null,
              externalDeletedAt: opt.deleted_at ? new Date(opt.deleted_at) : null,
              rawPayload: opt as object,
              syncedAt: now,
            },
          });
          options_upserted++;
        } catch (err) {
          warnings.push(
            `modifier option ${opt.id} (group ${mod.id}): ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    } catch (err) {
      warnings.push(`modifier group ${mod.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { groups_upserted, options_upserted, warnings };
}

// ─── Phase A — Payment type mirror sync ──────────────────────────────────────

export async function syncLoyversePaymentTypes(
  adapter: LoyverseAdapter
): Promise<{ upserted: number; warnings: string[] }> {
  const warnings: string[] = [];
  let upserted = 0;

  const result = await adapter.fetchRawPaymentTypes();
  if (!result.success || !result.data) {
    warnings.push(`fetchRawPaymentTypes failed: ${result.error ?? "unknown error"}`);
    return { upserted, warnings };
  }

  for (const pt of result.data) {
    try {
      const now = new Date();

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
          syncedAt: now,
        },
        update: {
          name: pt.name,
          paymentTypeCode: pt.type ?? null,
          externalUpdatedAt: pt.updated_at ? new Date(pt.updated_at) : null,
          externalDeletedAt: pt.deleted_at ? new Date(pt.deleted_at) : null,
          rawPayload: pt as object,
          syncedAt: now,
        },
      });
      upserted++;

      // Reconcile store links
      const upstreamStoreIds = (pt.stores ?? []).map((s) => s.store_id);
      for (const storeId of upstreamStoreIds) {
        try {
          await prisma.channelPaymentTypeStoreLink.upsert({
            where: {
              channel_channelPaymentTypeId_storeExternalId: {
                channel: Channel.LOYVERSE,
                channelPaymentTypeId: channelPt.id,
                storeExternalId: storeId,
              },
            },
            create: {
              channel: Channel.LOYVERSE,
              channelPaymentTypeId: channelPt.id,
              storeExternalId: storeId,
            },
            update: {},
          });
        } catch (err) {
          warnings.push(
            `payment type ${pt.id} store link ${storeId}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
      if (upstreamStoreIds.length > 0) {
        await prisma.channelPaymentTypeStoreLink.deleteMany({
          where: {
            channel: Channel.LOYVERSE,
            channelPaymentTypeId: channelPt.id,
            storeExternalId: { notIn: upstreamStoreIds },
          },
        });
      }
    } catch (err) {
      warnings.push(`payment type ${pt.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { upserted, warnings };
}

// ─── Phase A — Items, variants, and nested links ──────────────────────────────

export async function syncLoyverseItemsAndVariants(
  adapter: LoyverseAdapter
): Promise<{
  items_upserted: number;
  variants_upserted: number;
  component_links_synced: number;
  item_tax_links_synced: number;
  item_modifier_links_synced: number;
  variant_store_rows_synced: number;
  warnings: string[];
}> {
  const warnings: string[] = [];
  let items_upserted = 0;
  let variants_upserted = 0;
  let component_links_synced = 0;
  let item_tax_links_synced = 0;
  let item_modifier_links_synced = 0;
  let variant_store_rows_synced = 0;

  const result = await adapter.fetchRawItems();
  if (!result.success || !result.data) {
    warnings.push(`fetchRawItems failed: ${result.error ?? "unknown error"}`);
    return {
      items_upserted,
      variants_upserted,
      component_links_synced,
      item_tax_links_synced,
      item_modifier_links_synced,
      variant_store_rows_synced,
      warnings,
    };
  }

  for (const item of result.data) {
    try {
      const now = new Date();

      // Resolve mirrored category
      let channelCategoryId: string | null = null;
      if (item.category_id) {
        const chanCat = await prisma.channelCategory.findUnique({
          where: { channel_externalId: { channel: Channel.LOYVERSE, externalId: item.category_id } },
        });
        if (chanCat) {
          channelCategoryId = chanCat.id;
        } else {
          warnings.push(`item ${item.id}: category ${item.category_id} not found in mirror — keeping null`);
        }
      }

      // Derive option names from first variant if not present at item level
      const firstVariant = item.variants?.[0];
      const option1Name = item.option1_name ?? firstVariant?.option1_name ?? null;
      const option2Name = item.option2_name ?? firstVariant?.option2_name ?? null;
      const option3Name = item.option3_name ?? firstVariant?.option3_name ?? null;

      const channelItem = await prisma.channelItem.upsert({
        where: { channel_externalId: { channel: Channel.LOYVERSE, externalId: item.id } },
        create: {
          channel: Channel.LOYVERSE,
          externalId: item.id,
          channelCategoryId,
          handle: item.handle ?? null,
          itemName: item.item_name,
          description: item.description ?? null,
          referenceId: item.reference_id ?? null,
          trackStock: item.track_stock ?? false,
          soldByWeight: item.sold_by_weight ?? false,
          isComposite: item.is_composite ?? false,
          useProduction: item.use_production ?? false,
          primarySupplierId: item.primary_supplier_id ?? null,
          form: item.form ?? null,
          color: item.color ?? null,
          imageUrl: item.image_url ?? null,
          option1Name,
          option2Name,
          option3Name,
          externalCreatedAt: item.created_at ? new Date(item.created_at) : null,
          externalUpdatedAt: item.updated_at ? new Date(item.updated_at) : null,
          externalDeletedAt: item.deleted_at ? new Date(item.deleted_at) : null,
          rawPayload: item as object,
          syncedAt: now,
        },
        update: {
          channelCategoryId,
          handle: item.handle ?? null,
          itemName: item.item_name,
          description: item.description ?? null,
          referenceId: item.reference_id ?? null,
          trackStock: item.track_stock ?? false,
          soldByWeight: item.sold_by_weight ?? false,
          isComposite: item.is_composite ?? false,
          useProduction: item.use_production ?? false,
          primarySupplierId: item.primary_supplier_id ?? null,
          form: item.form ?? null,
          color: item.color ?? null,
          imageUrl: item.image_url ?? null,
          option1Name,
          option2Name,
          option3Name,
          externalUpdatedAt: item.updated_at ? new Date(item.updated_at) : null,
          externalDeletedAt: item.deleted_at ? new Date(item.deleted_at) : null,
          rawPayload: item as object,
          syncedAt: now,
        },
      });
      items_upserted++;

      // ── Item modifier-group links ──
      const upstreamModIds = item.modifier_ids ?? [];
      // Remove stale links not present upstream
      await prisma.channelItemModifierGroupLink.deleteMany({
        where: {
          channel: Channel.LOYVERSE,
          channelItemId: channelItem.id,
          ...(upstreamModIds.length > 0
            ? { channelModifierGroupExternalId: { notIn: upstreamModIds } }
            : {}),
        },
      });
      for (const modId of upstreamModIds) {
        try {
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
          item_modifier_links_synced++;
        } catch (err) {
          warnings.push(
            `item ${item.id} modifier link ${modId}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      // ── Item tax links ──
      const upstreamTaxIds = item.tax_ids ?? [];
      await prisma.channelItemTaxLink.deleteMany({
        where: {
          channel: Channel.LOYVERSE,
          channelItemId: channelItem.id,
          ...(upstreamTaxIds.length > 0 ? { taxExternalId: { notIn: upstreamTaxIds } } : {}),
        },
      });
      for (const taxId of upstreamTaxIds) {
        try {
          await prisma.channelItemTaxLink.upsert({
            where: {
              channel_channelItemId_taxExternalId: {
                channel: Channel.LOYVERSE,
                channelItemId: channelItem.id,
                taxExternalId: taxId,
              },
            },
            create: {
              channel: Channel.LOYVERSE,
              channelItemId: channelItem.id,
              taxExternalId: taxId,
            },
            update: {},
          });
          item_tax_links_synced++;
        } catch (err) {
          warnings.push(
            `item ${item.id} tax link ${taxId}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      // ── Item component links (composite items) ──
      const upstreamComponents = item.components ?? [];
      const upstreamComponentVariantIds = upstreamComponents.map((c) => c.variant_id);
      await prisma.channelItemComponent.deleteMany({
        where: {
          channel: Channel.LOYVERSE,
          channelItemId: channelItem.id,
          ...(upstreamComponentVariantIds.length > 0
            ? { channelVariantExternalId: { notIn: upstreamComponentVariantIds } }
            : {}),
        },
      });
      for (const comp of upstreamComponents) {
        try {
          // ChannelItemComponent has no unique key beyond (channelItemId, channelVariantExternalId)
          // Use deleteMany + create for idempotency since there's no composite unique
          const existing = await prisma.channelItemComponent.findFirst({
            where: {
              channel: Channel.LOYVERSE,
              channelItemId: channelItem.id,
              channelVariantExternalId: comp.variant_id,
            },
          });
          if (existing) {
            await prisma.channelItemComponent.update({
              where: { id: existing.id },
              data: { quantity: comp.quantity, rawPayload: comp as object },
            });
          } else {
            await prisma.channelItemComponent.create({
              data: {
                channel: Channel.LOYVERSE,
                channelItemId: channelItem.id,
                channelVariantExternalId: comp.variant_id,
                quantity: comp.quantity,
                rawPayload: comp as object,
              },
            });
          }
          component_links_synced++;
        } catch (err) {
          warnings.push(
            `item ${item.id} component ${comp.variant_id}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      // ── Variants ──
      for (const variant of item.variants ?? []) {
        try {
          const channelVariant = await prisma.channelVariant.upsert({
            where: {
              channel_externalId: { channel: Channel.LOYVERSE, externalId: variant.variant_id },
            },
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
              purchaseCost: variant.purchase_cost ?? null,
              defaultPricingType: variant.default_pricing_type ?? null,
              defaultPrice: variant.default_price ?? null,
              externalCreatedAt: variant.created_at ? new Date(variant.created_at) : null,
              externalUpdatedAt: variant.updated_at ? new Date(variant.updated_at) : null,
              externalDeletedAt: variant.deleted_at ? new Date(variant.deleted_at) : null,
              rawPayload: variant as object,
              syncedAt: now,
            },
            update: {
              sku: variant.sku ?? null,
              referenceVariantId: variant.reference_id ?? null,
              option1Value: variant.option1_val ?? null,
              option2Value: variant.option2_val ?? null,
              option3Value: variant.option3_val ?? null,
              barcode: variant.barcode ?? null,
              cost: variant.cost ?? null,
              purchaseCost: variant.purchase_cost ?? null,
              defaultPricingType: variant.default_pricing_type ?? null,
              defaultPrice: variant.default_price ?? null,
              externalUpdatedAt: variant.updated_at ? new Date(variant.updated_at) : null,
              externalDeletedAt: variant.deleted_at ? new Date(variant.deleted_at) : null,
              rawPayload: variant as object,
              syncedAt: now,
            },
          });
          variants_upserted++;

          // ── Variant store data ──
          const upstreamStoreIds = (variant.stores ?? []).map((s) => s.store_id);
          for (const store of variant.stores ?? []) {
            try {
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
                  optimalStock: store.optimal_stock ?? null,
                  lowStock: store.low_stock ?? null,
                  rawPayload: store as object,
                },
                update: {
                  pricingType: store.pricing_type ?? null,
                  price: store.price ?? null,
                  availableForSale: store.available_for_sale ?? null,
                  optimalStock: store.optimal_stock ?? null,
                  lowStock: store.low_stock ?? null,
                  rawPayload: store as object,
                },
              });
              variant_store_rows_synced++;
            } catch (err) {
              warnings.push(
                `variant ${variant.variant_id} store ${store.store_id}: ${err instanceof Error ? err.message : String(err)}`
              );
            }
          }
          // Remove stale store rows
          if (upstreamStoreIds.length > 0) {
            await prisma.channelVariantStoreData.deleteMany({
              where: {
                channel: Channel.LOYVERSE,
                channelVariantId: channelVariant.id,
                storeExternalId: { notIn: upstreamStoreIds },
              },
            });
          }
        } catch (err) {
          warnings.push(
            `variant ${variant.variant_id} (item ${item.id}): ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    } catch (err) {
      warnings.push(`item ${item.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    items_upserted,
    variants_upserted,
    component_links_synced,
    item_tax_links_synced,
    item_modifier_links_synced,
    variant_store_rows_synced,
    warnings,
  };
}

// ─── Phase A — Link reconciliation ───────────────────────────────────────────
// Reconcile orphaned channel_item_modifier_group_links whose referenced
// modifier group external ID has no matching channel_modifier_groups row.
// Logs warnings but does not remove rows to preserve history.

export async function reconcileLoyverseItemLinks(): Promise<{ warnings: string[] }> {
  const warnings: string[] = [];

  const links = await prisma.channelItemModifierGroupLink.findMany({
    where: { channel: Channel.LOYVERSE },
  });

  const externalIds = [...new Set(links.map((l) => l.channelModifierGroupExternalId))];

  const existing = await prisma.channelModifierGroup.findMany({
    where: { channel: Channel.LOYVERSE, externalId: { in: externalIds } },
    select: { externalId: true },
  });

  const existingSet = new Set(existing.map((e) => e.externalId));

  for (const id of externalIds) {
    if (!existingSet.has(id)) {
      warnings.push(`reconcile: modifier group external_id ${id} referenced in item links but not found in mirror`);
    }
  }

  return { warnings };
}

// ─── Phase A — Main orchestrator ─────────────────────────────────────────────

export async function syncLoyverseCatalog(adapter: LoyverseAdapter): Promise<MirrorSyncSummary> {
  const warnings: string[] = [];
  const errors: string[] = [];

  const syncJob = await prisma.syncJob.create({
    data: { channel: Channel.LOYVERSE, syncType: "CATALOG_MIRROR_PULL", status: "RUNNING" },
  });

  try {
    // 1. Categories
    const catResult = await syncLoyverseCategories(adapter);
    warnings.push(...catResult.warnings);

    // 2. Modifiers
    const modResult = await syncLoyverseModifiers(adapter);
    warnings.push(...modResult.warnings);

    // 3. Payment types
    const ptResult = await syncLoyversePaymentTypes(adapter);
    warnings.push(...ptResult.warnings);

    // 4. Items and variants
    const itemResult = await syncLoyverseItemsAndVariants(adapter);
    warnings.push(...itemResult.warnings);

    // 5. Link reconciliation
    const reconcileResult = await reconcileLoyverseItemLinks();
    warnings.push(...reconcileResult.warnings);

    const summary: MirrorSyncSummary = {
      categories_upserted: catResult.upserted,
      modifier_groups_upserted: modResult.groups_upserted,
      modifier_options_upserted: modResult.options_upserted,
      payment_types_upserted: ptResult.upserted,
      items_upserted: itemResult.items_upserted,
      variants_upserted: itemResult.variants_upserted,
      component_links_synced: itemResult.component_links_synced,
      item_tax_links_synced: itemResult.item_tax_links_synced,
      item_modifier_links_synced: itemResult.item_modifier_links_synced,
      variant_store_rows_synced: itemResult.variant_store_rows_synced,
      warnings,
      errors,
    };

    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: errors.length > 0 ? "FAILED" : warnings.length > 0 ? "PARTIAL" : "SUCCESS",
        finishedAt: new Date(),
        summary: summary as object,
      },
    });

    return summary;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    errors.push(errorMessage);
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: { status: "FAILED", finishedAt: new Date(), errorMessage },
    });
    return {
      categories_upserted: 0,
      modifier_groups_upserted: 0,
      modifier_options_upserted: 0,
      payment_types_upserted: 0,
      items_upserted: 0,
      variants_upserted: 0,
      component_links_synced: 0,
      item_tax_links_synced: 0,
      item_modifier_links_synced: 0,
      variant_store_rows_synced: 0,
      warnings,
      errors,
    };
  }
}
