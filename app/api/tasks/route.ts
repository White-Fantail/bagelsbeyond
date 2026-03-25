/**
 * GET  /api/tasks        — list scheduled tasks (paginated, filterable)
 * POST /api/tasks        — create a new scheduled task (and optionally run it)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  scheduleExternalFactorCollection,
  schedulePredictionGeneration,
  runExternalFactorCollectionTask,
  runPredictionGenerationTask,
} from "@/lib/services/taskService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status") ?? undefined;
    const taskType = searchParams.get("taskType") ?? undefined;
    const take = Math.min(parseInt(searchParams.get("take") ?? "50"), 100);
    const skip = parseInt(searchParams.get("skip") ?? "0");

    const tasks = await prisma.scheduledTask.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(taskType ? { taskType } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: { _count: { select: { logs: true } } },
    });

    const total = await prisma.scheduledTask.count({
      where: {
        ...(status ? { status } : {}),
        ...(taskType ? { taskType } : {}),
      },
    });

    return NextResponse.json({ tasks, total });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { taskType: string; targetDate?: string; runNow?: boolean };
    const { taskType, targetDate, runNow } = body;

    if (!taskType) {
      return NextResponse.json({ error: "taskType is required" }, { status: 400 });
    }

    const date = targetDate ? new Date(targetDate) : undefined;
    if (targetDate && isNaN(date!.getTime())) {
      return NextResponse.json({ error: "Invalid targetDate" }, { status: 400 });
    }

    let taskId: string;
    if (taskType === "collect_external_factors") {
      if (!date) return NextResponse.json({ error: "targetDate required for collect_external_factors" }, { status: 400 });
      taskId = await scheduleExternalFactorCollection(date);
    } else if (taskType === "generate_prediction") {
      if (!date) return NextResponse.json({ error: "targetDate required for generate_prediction" }, { status: 400 });
      taskId = await schedulePredictionGeneration(date);
    } else {
      return NextResponse.json({ error: `Unknown taskType: ${taskType}` }, { status: 400 });
    }

    if (runNow) {
      if (taskType === "collect_external_factors") {
        await runExternalFactorCollectionTask(taskId);
      } else if (taskType === "generate_prediction") {
        await runPredictionGenerationTask(taskId);
      }
    }

    const task = await prisma.scheduledTask.findUnique({ where: { id: taskId } });
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
