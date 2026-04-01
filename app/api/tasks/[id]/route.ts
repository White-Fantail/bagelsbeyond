/**
 * GET /api/tasks/[id]  — task detail with logs
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireStaffOrAdmin, isNextResponse } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const { id } = await params;
    const task = await prisma.scheduledTask.findUnique({
      where: { id },
      include: { logs: { orderBy: { createdAt: "asc" } } },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
