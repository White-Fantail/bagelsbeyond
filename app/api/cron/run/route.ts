/**
 * POST /api/cron/run
 *
 * Trigger endpoint for running all pending scheduled tasks.
 * Can be called by:
 *   - AWS EventBridge / CloudWatch scheduled rules
 *   - GitHub Actions cron workflow
 *   - Amplify scheduled functions
 *   - Any HTTP-based cron service (cron-job.org, EasyCron, etc.)
 *
 * Optionally protected by CRON_SECRET header to prevent unauthorized calls.
 */

import { NextRequest, NextResponse } from "next/server";
import { runPendingTasks } from "@/lib/services/taskService";
import {
  ensureExternalFactorsForNextDays,
  schedulePredictionForNextDay,
} from "@/lib/services/schedulerService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Optional secret-based auth
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = req.headers.get("authorization") ?? "";
      if (auth !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await req.json().catch((err: unknown) => {
      console.warn("[/api/cron/run] Failed to parse JSON body:", err instanceof Error ? err.message : String(err));
      return {} as Record<string, unknown>;
    }) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "run_pending";

    const results: Record<string, unknown> = {};

    if (action === "run_pending" || action === "all") {
      results.pendingTasks = await runPendingTasks();
    }

    if (action === "ensure_external_factors" || action === "all") {
      // Ensure today + tomorrow + day-after-tomorrow
      const taskIds = await ensureExternalFactorsForNextDays(2);
      results.externalFactorTaskIds = taskIds;
    }

    if (action === "schedule_tomorrow_prediction" || action === "all") {
      const taskId = await schedulePredictionForNextDay();
      results.predictionTaskId = taskId;
      // Run it immediately
      const pending = await runPendingTasks();
      results.ranAfterSchedule = pending;
    }

    if (action === "daily_order_push" || action === "all") {
      results.dailyOrderPush = { message: "daily_order_push is not available in this version" };
    }

    return NextResponse.json({ ok: true, action, results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // Convenience: also allow GET for simple cron callers
  return POST(req);
}
