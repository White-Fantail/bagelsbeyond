import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import {
  previewLoyverseItemMatches,
  syncLoyverseCatalog,
  type LoyverseSyncDecisions,
} from "@/lib/services/loyverseProductSyncService";

function parseDecisions(input: unknown): LoyverseSyncDecisions {
  if (!input || typeof input !== "object") return {};

  const raw = input as Record<string, unknown>;
  const decisions: LoyverseSyncDecisions = {};

  for (const [itemId, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") continue;
    const decision = value as Record<string, unknown>;
    const action = decision.action;
    if (action !== "skip" && action !== "match" && action !== "create") continue;

    if (action === "match") {
      const localProductId =
        typeof decision.localProductId === "string" && decision.localProductId.length > 0
          ? decision.localProductId
          : undefined;
      decisions[itemId] = { action, localProductId };
      continue;
    }

    decisions[itemId] = { action };
  }

  return decisions;
}

export async function GET() {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const items = await previewLoyverseItemMatches();
    const matchedCount = items.filter((item) => item.status === "matched").length;
    const unmatchedCount = items.length - matchedCount;

    return NextResponse.json({
      items,
      matchedCount,
      unmatchedCount,
      total: items.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load Loyverse preview";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    const decisions = parseDecisions((body as Record<string, unknown>)?.decisions);
    const result = await syncLoyverseCatalog(authResult.userId, decisions);
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Loyverse sync failed";
    return NextResponse.json({ message }, { status: 500 });
  }
}
