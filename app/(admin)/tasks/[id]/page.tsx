export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatTaskStatus, formatTaskType, getTaskStatusColor } from "@/lib/task-utils";
import RetryTaskButton from "@/components/RetryTaskButton";

const LOG_LEVEL_COLORS: Record<string, string> = {
  info: "text-gray-700 bg-gray-50",
  warning: "text-yellow-800 bg-yellow-50",
  error: "text-red-800 bg-red-50",
};

const LOG_LEVEL_ICONS: Record<string, string> = {
  info: "ℹ️",
  warning: "⚠️",
  error: "❌",
};

async function getTaskDetail(id: string) {
  const task = await prisma.scheduledTask.findUnique({
    where: { id },
    include: { logs: { orderBy: { createdAt: "asc" } } },
  });
  return task;
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const task = await getTaskDetail(id);

  if (!task) notFound();

  const durationMs =
    task.startedAt && task.finishedAt
      ? new Date(task.finishedAt).getTime() - new Date(task.startedAt).getTime()
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/tasks" className="text-sm text-indigo-600 hover:underline mb-2 inline-block">
            ← Task List
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{formatTaskType(task.taskType)}</h1>
          <p className="text-gray-500 mt-1 text-sm font-mono">{task.id}</p>
        </div>
        <RetryTaskButton taskId={task.id} currentStatus={task.status} />
      </div>

      {/* Detail card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500">Status</p>
          <span className={`inline-block px-2 py-0.5 rounded text-sm font-medium mt-1 ${getTaskStatusColor(task.status)}`}>
            {formatTaskStatus(task.status)}
          </span>
        </div>

        <div>
          <p className="text-xs text-gray-500">Target Date</p>
          <p className="text-sm font-medium text-gray-800 mt-1">
            {task.targetDate
              ? new Date(task.targetDate).toLocaleDateString("en-NZ", { year: "numeric", month: "long", day: "numeric" })
              : "-"}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500">Started At</p>
          <p className="text-sm font-medium text-gray-800 mt-1">
            {task.startedAt ? new Date(task.startedAt).toLocaleString("en-NZ") : "-"}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500">Completed At</p>
          <p className="text-sm font-medium text-gray-800 mt-1">
            {task.finishedAt ? new Date(task.finishedAt).toLocaleString("en-NZ") : "-"}
          </p>
        </div>

        {durationMs !== null && (
          <div>
            <p className="text-xs text-gray-500">Duration</p>
            <p className="text-sm font-medium text-gray-800 mt-1">{(durationMs / 1000).toFixed(2)}s</p>
          </div>
        )}

        <div>
          <p className="text-xs text-gray-500">Retry Count</p>
          <p className="text-sm font-medium text-gray-800 mt-1">{task.retryCount}</p>
        </div>

        {task.resultSummary && (
          <div className="sm:col-span-2">
            <p className="text-xs text-gray-500">Result Summary</p>
            <p className="text-sm font-medium text-gray-800 mt-1">{task.resultSummary}</p>
          </div>
        )}

        {task.errorMessage && (
          <div className="sm:col-span-2">
            <p className="text-xs text-gray-500">Error Message</p>
            <p className="text-sm font-medium text-red-700 mt-1 bg-red-50 rounded p-2">
              {task.errorMessage}
            </p>
          </div>
        )}
      </div>

      {/* Task logs */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">📋 Task Log</h2>
        {task.logs.length === 0 ? (
          <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-400 text-sm">No logs.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {task.logs.map((log) => (
              <div
                key={log.id}
                className={`flex items-start gap-3 rounded-lg px-4 py-2.5 text-sm ${LOG_LEVEL_COLORS[log.level] ?? "text-gray-700 bg-gray-50"}`}
              >
                <span className="text-base shrink-0 mt-0.5">{LOG_LEVEL_ICONS[log.level] ?? "•"}</span>
                <span className="flex-1">{log.message}</span>
                <span className="text-xs text-gray-400 shrink-0 ml-2">
                  {new Date(log.createdAt).toLocaleTimeString("en-NZ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
