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
          <h1 className="text-2xl font-bold text-gray-900">자동화 작업 목록</h1>
          <p className="text-gray-500 mt-1">스케줄된 작업과 실행 상태를 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <TaskActionButton
            href="/api/cron/run"
            label="▶ 대기 작업 실행"
            body={{ action: "run_pending" }}
          />
          <TaskActionButton
            href="/api/cron/run"
            label="📡 외부요인 수집"
            body={{ action: "ensure_external_factors" }}
          />
          <TaskActionButton
            href="/api/cron/run"
            label="🔮 내일 예측"
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
          <p className="text-gray-500">아직 스케줄된 작업이 없습니다.</p>
          <p className="text-gray-400 text-sm mt-1">위 버튼을 눌러 작업을 실행해보세요.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">작업 유형</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">대상 날짜</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">상태</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">시작</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">완료</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">재시도</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">로그</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{formatTaskType(task.taskType)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {task.targetDate
                      ? new Date(task.targetDate).toLocaleDateString("ko-KR")
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTaskStatusColor(task.status)}`}>
                      {formatTaskStatus(task.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {task.startedAt
                      ? new Date(task.startedAt).toLocaleString("ko-KR")
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {task.finishedAt
                      ? new Date(task.finishedAt).toLocaleString("ko-KR")
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-center">{task.retryCount}</td>
                  <td className="px-4 py-3 text-gray-600 text-center">{task._count.logs}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/tasks/${task.id}`}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      상세 →
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
