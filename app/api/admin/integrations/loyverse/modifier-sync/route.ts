/**
 * POST /api/admin/integrations/loyverse/modifier-sync
 *
 * Fetches the current modifier list from the Loyverse API and persists the
 * result in `LoyverseModifierSyncLog`.  The stored entry is then served by
 * GET /api/admin/integrations/loyverse/external-modifiers so the Modifier
 * Mapping UI does not need to hit the live Loyverse API on every page load.
 *
 * ADMIN only.
 *
 * Response body (on all 2xx):
 * {
 *   status:        "success" | "empty" | "failed"
 *   groupCount:    number
 *   optionCount:   number
 *   syncedAt:      string (ISO)
 *   errorMessage?: string
 *   errorCode?:    number
 * }
 */

import { NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { createLoyverseAdapter } from "@/lib/integrations/adapters/pos/loyverse";
import { prisma } from "@/lib/db";
import type { LoyverseRawModifier } from "@/lib/integrations/adapters/pos/types";

export const dynamic = "force-dynamic";

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
    const optionCount = activeModifiers.reduce((sum, m) => sum + m.options.length, 0);

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

    console.info(
      `[modifier-sync] status=${status} groups=${groupCount} options=${optionCount} id=${log.id}`
    );

    return NextResponse.json({
      status,
      groupCount,
      optionCount,
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
