/**
 * POST /api/admin/integrations/loyverse/modifier-sync
 *
 * Fetches the current modifier list from the Loyverse API and:
 *   1. Persists raw groups in `LoyverseModifierSyncLog` (used by the external-modifiers endpoint).
 *   2. For every modifier group that already has an ExternalOptionGroupMap entry,
 *      updates the group name and upserts its options (with ExternalOptionMap records).
 *      Groups with no existing mapping are left untouched — they are created when the
 *      full product catalog sync runs.
 *
 * This ensures that after each modifier refresh:
 *   - All known groups reflect their current Loyverse names and option lists.
 *   - Each option carries its Loyverse external ID via ExternalOptionMap.
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
import { createLoyverseAdapter } from "@/lib/integrations/adapters/pos/loyverse";
import { prisma } from "@/lib/db";
import { IntegrationSource } from "@/app/generated/prisma/enums";
import type { LoyverseRawModifier } from "@/lib/integrations/adapters/pos/types";

export const dynamic = "force-dynamic";

/**
 * For each Loyverse modifier group that already has an internal ExternalOptionGroupMap,
 * update the group name and upsert all its options + ExternalOptionMap records.
 * Returns { updatedGroups, updatedOptions }.
 */
async function upsertKnownModifierGroups(
  activeModifiers: LoyverseRawModifier[]
): Promise<{ updatedGroups: number; updatedOptions: number }> {
  let updatedGroups = 0;
  let updatedOptions = 0;

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
      // Group not yet in internal tables — will be created on full catalog sync.
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
    const existingByName = new Map(groupMap.optionGroup.options.map((o) => [o.name, o]));

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
            optionGroupId: groupMap.optionGroupId,
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

      updatedOptions++;
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

    // Upsert known modifier groups + options into internal tables.
    const { updatedGroups, updatedOptions } = await upsertKnownModifierGroups(activeModifiers);

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
