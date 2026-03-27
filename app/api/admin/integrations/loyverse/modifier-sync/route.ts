/**
 * POST /api/admin/integrations/loyverse/modifier-sync
 *
 * Fetches the current modifier list from the Loyverse API and:
 *   1. Persists raw groups in `LoyverseModifierSyncLog` (used by the external-modifiers endpoint).
 *   2. For every modifier group that already has an ExternalOptionGroupMap entry,
 *      updates the group name and upserts its options (with ExternalOptionMap records).
 *   3. For unmapped groups (no ExternalOptionGroupMap yet), fetches the Loyverse items list
 *      to determine which internal products use each group, then creates the group + options.
 *      Groups are always created, even when no matching internal product is found yet
 *      (productId is left null in that case). Product assignments are synced via
 *      ProductOptionGroupAssignment for all matched products.
 *
 * This ensures that after each modifier refresh:
 *   - All known groups reflect their current Loyverse names and option lists.
 *   - Each option carries its Loyverse external ID via ExternalOptionMap.
 *   - New modifier groups are always created (no longer skipped when product isn't synced yet).
 *   - Product–group relationships are kept in sync via ProductOptionGroupAssignment.
 *
 * ADMIN only.
 *
 * Response body (on all 2xx):
 * {
 *   status:         "success" | "empty" | "failed"
 *   groupCount:     number   (groups fetched from Loyverse)
 *   optionCount:    number   (options fetched from Loyverse)
 *   createdGroups:  number   (new groups written to internal DB)
 *   updatedGroups:  number   (existing groups updated in internal DB)
 *   createdOptions: number   (new options written to internal DB)
 *   updatedOptions: number   (existing options updated in internal DB)
 *   linkedProducts: number   (product–group assignments created/confirmed)
 *   skippedGroups:  number   (groups skipped due to errors or duplicates)
 *   syncedAt:       string (ISO)
 *   errorMessage?:  string
 *   errorCode?:     number
 * }
 */

import { NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { createLoyverseAdapter, type LoyverseAdapter } from "@/lib/integrations/adapters/pos/loyverse";
import { prisma } from "@/lib/db";
import { IntegrationSource } from "@/app/generated/prisma/enums";
import type { LoyverseRawModifier } from "@/lib/integrations/adapters/pos/types";

export const dynamic = "force-dynamic";

/** Upsert the options (and their ExternalOptionMap records) for one modifier group. */
async function upsertOptionsForGroup(
  optionGroupId: string,
  rawGroup: LoyverseRawModifier,
  existingOptions: Array<{ id: string; name: string }>
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  const existingByName = new Map(existingOptions.map((o) => [o.name, o]));

  for (const rawOption of rawGroup.options ?? []) {
    const existing = existingByName.get(rawOption.name);
    let optionId: string;

    if (existing) {
      await prisma.productOption.update({
        where: { id: existing.id },
        data: { priceDelta: rawOption.price, isActive: true },
      });
      optionId = existing.id;
      updated++;
    } else {
      const createdOption = await prisma.productOption.create({
        data: {
          optionGroupId,
          name: rawOption.name,
          priceDelta: rawOption.price,
          isActive: true,
        },
      });
      optionId = createdOption.id;
      created++;
    }

    // Upsert ExternalOptionMap — idempotent, safe to call on every sync.
    await prisma.externalOptionMap.upsert({
      where: {
        source_externalOptionId: {
          source: IntegrationSource.LOYVERSE,
          externalOptionId: rawOption.id,
        },
      },
      create: {
        source: IntegrationSource.LOYVERSE,
        productOptionId: optionId,
        externalOptionId: rawOption.id,
        externalName: rawOption.name,
        externalGroupId: rawGroup.id,
        externalGroupName: rawGroup.name,
        lastSyncedAt: new Date(),
      },
      update: {
        productOptionId: optionId,
        externalName: rawOption.name,
        externalGroupId: rawGroup.id,
        externalGroupName: rawGroup.name,
        lastSyncedAt: new Date(),
      },
    });
  }

  return { created, updated };
}

interface UpsertResult {
  createdGroups: number;
  updatedGroups: number;
  createdOptions: number;
  updatedOptions: number;
  linkedProducts: number;
  skippedGroups: number;
}

/**
 * For each Loyverse modifier group:
 *   - If already mapped (ExternalOptionGroupMap exists): update the group name and upsert options.
 *   - If unmapped: look up which Loyverse items use it, find all matching internal products,
 *     create the group + options, and link via ProductOptionGroupAssignment.
 *     Groups are ALWAYS created even when no matching product is found (productId = null).
 *
 * Returns full upsert statistics.
 */
async function upsertModifierGroups(
  activeModifiers: LoyverseRawModifier[],
  adapter: LoyverseAdapter
): Promise<UpsertResult> {
  let createdGroups = 0;
  let updatedGroups = 0;
  let createdOptions = 0;
  let updatedOptions = 0;
  let linkedProducts = 0;
  let skippedGroups = 0;
  const unmappedGroups: LoyverseRawModifier[] = [];

  console.info(
    `[modifier-sync] upsertModifierGroups start: ${activeModifiers.length} active groups`
  );

  // ── Pass 1: update already-mapped groups ────────────────────────────────────
  for (const rawGroup of activeModifiers) {
    const groupMap = await prisma.externalOptionGroupMap.findUnique({
      where: {
        source_externalOptionGroupId: {
          source: IntegrationSource.LOYVERSE,
          externalOptionGroupId: rawGroup.id,
        },
      },
      include: { optionGroup: { include: { options: true } } },
    });

    if (!groupMap) {
      unmappedGroups.push(rawGroup);
      continue;
    }

    // Update group name in case it was renamed in Loyverse.
    await prisma.productOptionGroup.update({
      where: { id: groupMap.optionGroupId },
      data: { name: rawGroup.name, updatedAt: new Date() },
    });
    await prisma.externalOptionGroupMap.update({
      where: { id: groupMap.id },
      data: { lastSyncedAt: new Date() },
    });

    updatedGroups++;
    const optCounts = await upsertOptionsForGroup(
      groupMap.optionGroupId,
      rawGroup,
      groupMap.optionGroup.options
    );
    createdOptions += optCounts.created;
    updatedOptions += optCounts.updated;

    console.info(
      `[modifier-sync] Pass1 updated group="${rawGroup.name}" id=${rawGroup.id} ` +
      `options_created=${optCounts.created} options_updated=${optCounts.updated}`
    );
  }

  console.info(
    `[modifier-sync] Pass1 done: updatedGroups=${updatedGroups} unmappedGroups=${unmappedGroups.length}`
  );

  // ── Pass 2: create/link groups that are new in Loyverse ─────────────────────
  if (unmappedGroups.length > 0) {
    // Fetch the full items list so we can find which products each modifier group belongs to.
    const items = await adapter.fetchItems();
    console.info(`[modifier-sync] Pass2 fetched ${items.length} Loyverse items for product linkage`);

    // Build modifier-id → [item-id] lookup (all active items).
    const modifierToItems = new Map<string, string[]>();
    for (const item of items) {
      if (item.deleted_at !== null) continue;
      for (const modId of item.modifiers_ids ?? []) {
        const existing = modifierToItems.get(modId) ?? [];
        existing.push(item.id);
        modifierToItems.set(modId, existing);
      }
    }

    for (const rawGroup of unmappedGroups) {
      const itemIds = modifierToItems.get(rawGroup.id) ?? [];
      console.info(
        `[modifier-sync] Pass2 group="${rawGroup.name}" id=${rawGroup.id} ` +
        `loyverse_item_count=${itemIds.length} options=${(rawGroup.options ?? []).length}`
      );

      // Find ALL internal products that correspond to Loyverse items using this modifier.
      const productIds: string[] = [];
      for (const extItemId of itemIds) {
        const pm = await prisma.externalProductMap.findUnique({
          where: {
            source_externalProductId: {
              source: IntegrationSource.LOYVERSE,
              externalProductId: extItemId,
            },
          },
        });
        if (pm) {
          productIds.push(pm.productId);
        }
      }

      console.info(
        `[modifier-sync] Pass2 group="${rawGroup.name}": matched ${productIds.length} internal products ` +
        `(unmatched=${itemIds.length - productIds.length} items not yet synced)`
      );

      // Always create the group — use null productId when no product is synced yet.
      // productId can be updated later when the product catalog is synced.
      // The first matched product is recorded as the group's direct owner for
      // backward compatibility; all matches are also linked via assignments below.
      const groupProductId = productIds[0] ?? null;

      let newGroupId: string;
      try {
        const newGroup = await prisma.productOptionGroup.create({
          data: {
            productId: groupProductId,
            name: rawGroup.name,
          },
        });
        newGroupId = newGroup.id;
      } catch (err) {
        console.error(
          `[modifier-sync] Pass2 FAILED to create group="${rawGroup.name}" id=${rawGroup.id}: ${String(err)}`
        );
        skippedGroups++;
        continue;
      }

      await prisma.externalOptionGroupMap.create({
        data: {
          source: IntegrationSource.LOYVERSE,
          externalOptionGroupId: rawGroup.id,
          optionGroupId: newGroupId,
          lastSyncedAt: new Date(),
        },
      });

      createdGroups++;

      // Create ProductOptionGroupAssignment for every matched product.
      for (const productId of productIds) {
        try {
          await prisma.productOptionGroupAssignment.upsert({
            where: {
              productId_optionGroupId: { productId, optionGroupId: newGroupId },
            },
            create: { productId, optionGroupId: newGroupId },
            update: {},
          });
          linkedProducts++;
        } catch (err) {
          console.error(
            `[modifier-sync] Pass2 FAILED to link group="${rawGroup.name}" → productId=${productId}: ${String(err)}`
          );
        }
      }

      const optCounts = await upsertOptionsForGroup(newGroupId, rawGroup, []);
      createdOptions += optCounts.created;
      updatedOptions += optCounts.updated;

      console.info(
        `[modifier-sync] Pass2 created group="${rawGroup.name}" internalId=${newGroupId} ` +
        `options_created=${optCounts.created} linked_products=${productIds.length}`
      );
    }
  }

  console.info(
    `[modifier-sync] upsertModifierGroups done: ` +
    `createdGroups=${createdGroups} updatedGroups=${updatedGroups} ` +
    `createdOptions=${createdOptions} updatedOptions=${updatedOptions} ` +
    `linkedProducts=${linkedProducts} skippedGroups=${skippedGroups}`
  );

  return { createdGroups, updatedGroups, createdOptions, updatedOptions, linkedProducts, skippedGroups };
}

export async function POST() {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  let rawModifiers: LoyverseRawModifier[] = [];
  let status: "success" | "empty" | "failed" = "failed";
  let errorMessage: string | undefined;
  let errorCode: number | undefined;

  const adapter = createLoyverseAdapter();

  try {
    rawModifiers = await adapter.fetchModifiers();

    const activeModifiers = rawModifiers.filter((m) => m.deleted_at === null);
    const groupCount = activeModifiers.length;
    const optionCount = activeModifiers.reduce((sum, m) => sum + (m.options ?? []).length, 0);

    status = groupCount === 0 ? "empty" : "success";

    console.info(
      `[modifier-sync] Loyverse returned ${groupCount} active groups, ${optionCount} options`
    );

    const log = await prisma.loyverseModifierSyncLog.create({
      data: {
        status,
        groupCount,
        optionCount,
        // Prisma Json type accepts any JSON-serialisable value
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rawGroups: activeModifiers as any,
      },
    });

    // Upsert modifier groups + options into internal tables.
    const { createdGroups, updatedGroups, createdOptions, updatedOptions, linkedProducts, skippedGroups } =
      await upsertModifierGroups(activeModifiers, adapter);

    console.info(
      `[modifier-sync] DONE status=${status} loyverse_groups=${groupCount} loyverse_options=${optionCount} ` +
      `created_groups=${createdGroups} updated_groups=${updatedGroups} ` +
      `created_options=${createdOptions} updated_options=${updatedOptions} ` +
      `linked_products=${linkedProducts} skipped_groups=${skippedGroups} log_id=${log.id}`
    );

    return NextResponse.json({
      status,
      groupCount,
      optionCount,
      createdGroups,
      updatedGroups,
      createdOptions,
      updatedOptions,
      linkedProducts,
      skippedGroups,
      syncedAt: log.syncedAt.toISOString(),
    });
  } catch (err: unknown) {
    errorMessage = err instanceof Error ? err.message : String(err);

    // Extract HTTP status code from LoyverseApiError message pattern
    // e.g. "Loyverse authentication failed — check LOYVERSE_API_TOKEN"
    const statusMatch = errorMessage.match(/HTTP (\d{3})/);
    errorCode = statusMatch ? Number(statusMatch[1]) : undefined;

    // Determine a user-friendly code from the message
    if (!errorCode) {
      if (
        errorMessage.includes("authentication failed") ||
        errorMessage.includes("LOYVERSE_API_TOKEN")
      ) {
        errorCode = 401;
      } else if (errorMessage.includes("not found") || errorMessage.includes("404")) {
        errorCode = 404;
      }
    }

    console.error(
      `[modifier-sync] FAILED errorCode=${errorCode ?? "N/A"} message=${errorMessage}`
    );

    try {
      await prisma.loyverseModifierSyncLog.create({
        data: {
          status: "failed",
          groupCount: 0,
          optionCount: 0,
          errorMessage,
          errorCode,
        },
      });
    } catch (dbErr) {
      console.error("[modifier-sync] Failed to persist error log:", dbErr);
    }

    return NextResponse.json(
      {
        status: "failed",
        groupCount: 0,
        optionCount: 0,
        createdGroups: 0,
        updatedGroups: 0,
        createdOptions: 0,
        updatedOptions: 0,
        linkedProducts: 0,
        skippedGroups: 0,
        syncedAt: new Date().toISOString(),
        errorMessage,
        errorCode,
      },
      { status: 502 }
    );
  }
}
