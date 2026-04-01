/**
 * POST /api/tasks/[id]/retry  — retry a failed or partial task
 */

import { NextRequest, NextResponse } from "next/server";
import { retryFailedTask } from "@/lib/services/taskService";
import { apiRequireStaffOrAdmin, isNextResponse } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const { id } = await params;
    await retryFailedTask(id);
    return NextResponse.json({ ok: true, taskId: id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes("not found") ? 404 : msg.includes("retryable") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
