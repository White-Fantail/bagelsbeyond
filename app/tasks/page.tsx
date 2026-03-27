export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatTaskStatus, formatTaskType, getTaskStatusColor } from "@/lib/task-utils";
import TaskActionButton from "@/components/TaskActionButton";

async function getTasksData() {
  try {
    const tasks = await prisma.scheduledTask.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { _count: { select: { logs: true } } },
    });

    const stats = await prisma.scheduledTask.groupBy({
      by: ["status"],
      _count: { id: true },
    });
    const statusMap: Record<string, number> = {};
    for (const s of stats) statusMap[s.status] = s._count.id;

    return { tasks, statusMap };
  } catch {
    return { tasks: [], statusMap: {} };
  }
}

export default async function TasksPage() {
  const { tasks, statusMap } = await getTasksData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automation Task List</h1>
          <p className="text-gray-500 mt-1">Manage scheduled tasks and run status.</p>
        </div>
        <div className="flex gap-2">
          <TaskActionButton
            href="/api/cron/run"
            label="▶ Run Pending Task"
            body={{ action: "run_pending" }}
          />
          <TaskActionButton
            href="/api/cron/run"
            label="📡 ExternalFactor Collect"
            body={{ action: "ensure_external_factors" }}
          />
          <TaskActionButton
            href="/api/cron/run"
            label="🔮 Tomorrow Predictions"
            body={{ action: "schedule_tomorrow_prediction" }}
          />
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {(["pending", "running", "success", "partial", "failed", "skipped"] as const).map((s) => (
          <div key={s} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">{formatTaskStatus(s)}</p>
            <p className={`text-xl font-bold mt-1 ${s === "failed" && (statusMap[s] ?? 0) > 0 ? "text-red-600" : s === "running" ? "text-blue-600" : "text-gray-700"}`}>
              {statusMap[s] ?? 0}
            </p>
          </div>
        ))}
      </div>

      {/* Task table */}
      {tasks.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500">No scheduled tasks yet.</p>
          <p className="text-gray-400 text-sm mt-1">Click the button above to run a task.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Task Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Target Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Started</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Completed</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Retry</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Log</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{formatTaskType(task.taskType)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {task.targetDate
                      ? new Date(task.targetDate).toLocaleDateString("en-NZ")
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTaskStatusColor(task.status)}`}>
                      {formatTaskStatus(task.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {task.startedAt
                      ? new Date(task.startedAt).toLocaleString("en-NZ")
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {task.finishedAt
                      ? new Date(task.finishedAt).toLocaleString("en-NZ")
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-center">{task.retryCount}</td>
                  <td className="px-4 py-3 text-gray-600 text-center">{task._count.logs}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/tasks/${task.id}`}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
