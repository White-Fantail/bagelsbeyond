/**
 * POST /api/internal/jobs/daily-order-push
 *
 * Protected internal endpoint that triggers the daily Loyverse order push.
 * Runs the full daily sync:
 *   1. Ensures today's subscription occurrences
 *   2. Converts occurrences to orders
 *   3. Pushes today's INTERNAL + SUBSCRIPTION orders to Loyverse
 *
 * Security:
 *   Requires "Authorization: Bearer <INTERNAL_JOB_SECRET>" header.
 *   If INTERNAL_JOB_SECRET is not set, the endpoint is disabled (403).
 *
 * Scheduling:
 *   Call this endpoint from a cron service (e.g. GitHub Actions, cron-job.org,
 *   AWS EventBridge) at your desired time each day.
 *
 * Environment variables:
 *   INTERNAL_JOB_SECRET   — Required. Bearer token to protect this endpoint.
 *   APP_TIMEZONE          — Business timezone for "today" calculation (default: Pacific/Auckland).
 *
 * Example cURL:
 *   curl -X POST https://your-domain.com/api/internal/jobs/daily-order-push \
 *     -H "Authorization: Bearer <INTERNAL_JOB_SECRET>"
 *
 * Optional body (JSON):
 *   { "date": "2024-01-15" }  — Override target date (YYYY-MM-DD in business timezone)
 */

import { NextRequest, NextResponse } from "next/server";
import { runDailyOrderPushSync } from "@/lib/services/daily-order-push";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // ── Authentication ─────────────────────────────────────────────────────────
  const secret = process.env.INTERNAL_JOB_SECRET;
  if (!secret) {
    // Endpoint is disabled if no secret is configured — never allow open access
    return NextResponse.json(
      {
        error:
          "INTERNAL_JOB_SECRET environment variable is not configured. " +
          "Please configure it before using this endpoint for security.",
      },
      { status: 403 }
    );
  }

  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse optional date override ───────────────────────────────────────────
  let targetDate: Date | undefined;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      const [year, month, day] = body.date.split("-").map(Number);
      targetDate = new Date(Date.UTC(year, month - 1, day));
    }
  } catch {
    // ignore body parse errors — use default date
  }

  // ── Run sync ───────────────────────────────────────────────────────────────
  try {
    const result = await runDailyOrderPushSync(targetDate);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[daily-order-push job] Unhandled error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
