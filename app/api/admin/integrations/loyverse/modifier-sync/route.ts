/**
 * POST /api/admin/integrations/loyverse/modifier-sync
 *
 * Fetches the current modifier list from the Loyverse API and:
 *   1. Persists raw groups in `LoyverseModifierSyncLog` (used by the external-modifiers endpoint).
 *   2. For every modifier group that already has an ExternalOptionGroupMap entry,
 *      updates the group name and upserts its options (with ExternalOptionMap records).
 *   3. For unmapped groups (no ExternalOptionGroupMap yet), fetches the Loyverse items list
 *      to determine which internal products use each group, then creates the group + options
 *      under the corresponding product. Groups whose parent product has not been synced yet
 *      are still skipped (a full catalog sync is required to create the product first).
 *
 * This ensures that after each modifier refresh:
 *   - All known groups reflect their current Loyverse names and option lists.
 *   - Each option carries its Loyverse external ID via ExternalOptionMap.
 *   - New modifier groups are created automatically as long as the product already exists
 *     in the internal database.
 *
 * ADMIN only.
 *
 * Response body (on all 2xx):
 * {
 *   status:        "success" | "empty" | "failed"
 *   groupCount:    number
 *   optionCount:   number
 *   updatedGroups: number   (groups upserted into internal tables)
 *   updatedOptions: number  (options upserted into internal tables)
 *   syncedAt:      string (ISO)
 *   errorMessage?: string
 *   errorCode?:    number
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
): Promise<number> {
  let count = 0;
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
    } else {
      const created = await prisma.productOption.create({
        data: {
          optionGroupId,
          name: rawOption.name,
          priceDelta: rawOption.price,
          isActive: true,
        },
      });
      optionId = created.id;
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

    count++;
  }
  return count;
}

/**
 * For each Loyverse modifier group:
 *   - If already mapped (ExternalOptionGroupMap exists): update the group name and upsert options.
 *   - If unmapped: look up which Loyverse items use it, find the matching internal product, and
 *     create the group + options under that product.
 *
 * Returns { updatedGroups, updatedOptions }.
 */
async function upsertModifierGroups(
  activeModifiers: LoyverseRawModifier[],
  adapter: LoyverseAdapter
): Promise<{ updatedGroups: number; updatedOptions: number }> {
  let updatedGroups = 0;
  let updatedOptions = 0;
  const unmappedGroups: LoyverseRawModifier[] = [];

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
    updatedOptions += await upsertOptionsForGroup(
      groupMap.optionGroupId,
      rawGroup,
      groupMap.optionGroup.options
    );
  }

  // ── Pass 2: create groups that are new in Loyverse but whose product is already synced ─
  if (unmappedGroups.length > 0) {
    // Fetch the full items list so we can find which product each modifier group belongs to.
    const items = await adapter.fetchItems();

    // Build modifier-id → [item-id] lookup.
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

      // Find the first internal product that corresponds to a Loyverse item using this modifier.
      let productId: string | null = null;
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
          productId = pm.productId;
          break;
        }
      }

      if (!productId) {
        // Parent product has not been synced yet — skip; will be created on full catalog sync.
        continue;
      }

      // Create the new ProductOptionGroup + ExternalOptionGroupMap.
      const newGroup = await prisma.productOptionGroup.create({
        data: {
          productId,
          name: rawGroup.name,
        },
      });
      await prisma.externalOptionGroupMap.create({
        data: {
          source: IntegrationSource.LOYVERSE,
          externalOptionGroupId: rawGroup.id,
          optionGroupId: newGroup.id,
          lastSyncedAt: new Date(),
        },
      });

      updatedGroups++;
      updatedOptions += await upsertOptionsForGroup(newGroup.id, rawGroup, []);
    }
  }

  return { updatedGroups, updatedOptions };
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
    const { updatedGroups, updatedOptions } = await upsertModifierGroups(activeModifiers, adapter);

    console.info(
      `[modifier-sync] status=${status} groups=${groupCount} options=${optionCount} ` +
      `updated_groups=${updatedGroups} updated_options=${updatedOptions} id=${log.id}`
    );

    return NextResponse.json({
      status,
      groupCount,
      optionCount,
      updatedGroups,
      updatedOptions,
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
        syncedAt: new Date().toISOString(),
        errorMessage,
        errorCode,
      },
      { status: 502 }
    );
  }
}
