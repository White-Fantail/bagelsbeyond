/**
 * POST /api/admin/sync/orders/run
 *
 * Manually trigger the daily order push sync from the admin UI.
 * Requires ADMIN role (session-based auth).
 *
 * Optional body: { "date": "YYYY-MM-DD" }
 */

import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { runDailyOrderPushSync } from "@/lib/services/daily-order-push";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  let targetDate: Date | undefined;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      const [year, month, day] = body.date.split("-").map(Number);
      targetDate = new Date(Date.UTC(year, month - 1, day));
    }
  } catch {
    // ignore — use default date
  }

  try {
    const result = await runDailyOrderPushSync(targetDate);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[admin/sync/orders/run] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
