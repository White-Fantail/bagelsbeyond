/**
 * POST /api/admin/sync/orders/retry
 *
 * Retry pushing a specific order to Loyverse.
 * Requires ADMIN role.
 *
 * Body: { "orderId": "<order-id>" }
 */

import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { pushOrderToPOS } from "@/lib/integrations/services/order-sync";
import { createLoyverseAdapter } from "@/lib/integrations/adapters/pos/loyverse";
import { IntegrationSource } from "@/app/generated/prisma/enums";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  let orderId: string;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (typeof body.orderId !== "string" || !body.orderId) {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400 }
      );
    }
    orderId = body.orderId;
  } catch {
    return NextResponse.json({ error: "Invalid request format" }, { status: 400 });
  }

  try {
    const adapter = createLoyverseAdapter();
    const result = await pushOrderToPOS(
      orderId,
      adapter,
      IntegrationSource.LOYVERSE,
      { forceRetry: true }
    );

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[sync/orders/retry] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
