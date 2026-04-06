export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getTotalSales, getSoldBagels, formatCurrency, formatDate } from "@/lib/utils";
import { getWasteRate } from "@/lib/analytics";
import { comparePredictedVsActual } from "@/lib/prediction-utils";
import { formatTaskStatus, formatTaskType, getTaskStatusColor } from "@/lib/task-utils";
import { getPeriodComparison } from "@/lib/services/analytics";
import { formatCurrencyNZD } from "@/lib/analytics-utils";
import TaskActionButton from "@/components/TaskActionButton";
import { getSession } from "@/lib/auth/session";
import type { DailyRecord, SalesPrediction } from "@/types";

async function getDashboardData() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Recent 7 days
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const recentRecords: DailyRecord[] = await prisma.dailyRecord.findMany({
      where: { date: { gte: sevenDaysAgo, lt: today } },
      orderBy: { date: "desc" },
      take: 7,
    });

    const totalSalesSum = recentRecords.reduce((sum, r) => sum + getTotalSales(r), 0);
    const avgDailySales = recentRecords.length > 0 ? totalSalesSum / recentRecords.length : 0;
    const avgBagelsSold =
      recentRecords.length > 0
        ? recentRecords.reduce((sum, r) => sum + getSoldBagels(r), 0) / recentRecords.length
        : 0;
    const avgWasteRate =
      recentRecords.length > 0
        ? recentRecords.reduce((sum, r) => sum + getWasteRate(r), 0) / recentRecords.length
        : 0;

    // Tomorrow's prediction
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);
    const tomorrowPrediction = (await prisma.salesPrediction.findFirst({
      where: { targetDate: { gte: tomorrow, lte: tomorrowEnd } },
      orderBy: { createdAt: "desc" },
    })) as SalesPrediction | null;

    // Recent predictions for accuracy
    const recentPredictions = (await prisma.salesPrediction.findMany({
      orderBy: { targetDate: "desc" },
      take: 10,
      where: { targetDate: { lt: today } },
    })) as SalesPrediction[];

    // Accuracy summary
    let accurateCount = 0;
    let comparableCount = 0;
    for (const pred of recentPredictions) {
      const start = new Date(pred.targetDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(pred.targetDate);
      end.setHours(23, 59, 59, 999);
      const actual = await prisma.dailyRecord.findFirst({ where: { date: { gte: start, lte: end } } });
      if (actual) {
        comparableCount++;
        const cmp = comparePredictedVsActual(pred, actual as DailyRecord);
        if (cmp.direction === "accurate") accurateCount++;
      }
    }

    const latestImportJob = await prisma.importJob.findFirst({
      orderBy: { createdAt: "desc" },
    });

    const latestExternalFactor = await prisma.dailyExternalFactor.findFirst({
      orderBy: { id: "desc" },
      include: { dailyRecord: { select: { date: true } } },
    });

    // Task status summary — isolated so a missing migration doesn't break the whole dashboard
    let taskStatusMap: Record<string, number> = {};
    let recentTasks: Awaited<ReturnType<typeof prisma.scheduledTask.findMany>> = [];
    let lastExternalFactorTask: Awaited<ReturnType<typeof prisma.scheduledTask.findFirst>> = null;
    let lastPredictionTask: Awaited<ReturnType<typeof prisma.scheduledTask.findFirst>> = null;
    try {
      const taskStats = await prisma.scheduledTask.groupBy({
        by: ["status"],
        _count: { id: true },
      });
      for (const s of taskStats) taskStatusMap[s.status] = s._count.id;

      recentTasks = await prisma.scheduledTask.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      lastExternalFactorTask = await prisma.scheduledTask.findFirst({
        where: { taskType: "collect_external_factors", status: "success" },
        orderBy: { finishedAt: "desc" },
      });

      lastPredictionTask = await prisma.scheduledTask.findFirst({
        where: { taskType: "generate_prediction", status: "success" },
        orderBy: { finishedAt: "desc" },
      });
    } catch {
      // scheduled_tasks table may not exist yet — skip task data gracefully
    }

    return {
      recentRecords,
      avgDailySales,
      avgBagelsSold,
      avgWasteRate,
      totalSalesSum,
      tomorrowPrediction,
      accurateCount,
      comparableCount,
      latestImportJob,
      latestExternalFactor,
      taskStatusMap,
      recentTasks,
      lastExternalFactorTask,
      lastPredictionTask,
    };
  } catch {
    return {
      recentRecords: [],
      avgDailySales: 0,
      avgBagelsSold: 0,
      avgWasteRate: 0,
      totalSalesSum: 0,
      tomorrowPrediction: null,
      accurateCount: 0,
      comparableCount: 0,
      latestImportJob: null,
      latestExternalFactor: null,
      taskStatusMap: {},
      recentTasks: [],
      lastExternalFactorTask: null,
      lastPredictionTask: null,
    };
  }
}

export default async function DashboardPage() {
  // Require authentication — redirect to login if not logged in
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const {
    recentRecords,
    avgDailySales,
    avgBagelsSold,
    avgWasteRate,
    totalSalesSum,
    tomorrowPrediction,
    accurateCount,
    comparableCount,
    latestImportJob,
    latestExternalFactor,
    taskStatusMap,
    recentTasks,
    lastExternalFactorTask,
    lastPredictionTask,
  } = await getDashboardData();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  const accuracyRate = comparableCount > 0 ? Math.round((accurateCount / comparableCount) * 100) : null;

  // Analytics comparison data
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const cur7Start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  cur7Start.setHours(0, 0, 0, 0);
  const prev7End = new Date(cur7Start.getTime() - 1);
  const prev7Start = new Date(prev7End.getTime() - 7 * 24 * 60 * 60 * 1000);
  prev7Start.setHours(0, 0, 0, 0);

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const lastMonthEnd = new Date(thisMonthStart.getTime() - 1);
  const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1, 0, 0, 0, 0);

  const [week7Comparison, monthComparison] = await Promise.all([
    getPeriodComparison(cur7Start, now, prev7Start, prev7End).catch(() => null),
    getPeriodComparison(thisMonthStart, now, lastMonthStart, lastMonthEnd).catch(() => null),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Operations Dashboard</h1>
        <p className="text-gray-500 mt-1">Bagels Beyond — Daily operations status at a glance</p>
      </div>

      {/* Tomorrow Prediction Card */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">📅 Tomorrow Predictions</h2>
        {tomorrowPrediction ? (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-blue-600 font-medium">{formatDate(tomorrowPrediction.targetDate)}</p>
                <p className="text-3xl font-bold text-blue-900 mt-1">{formatCurrency(tomorrowPrediction.predictedSales)}</p>
              </div>
              {tomorrowPrediction.confidenceScore != null && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">Confidence</p>
                  <p className={`text-lg font-bold ${tomorrowPrediction.confidenceScore >= 70 ? "text-green-600" : tomorrowPrediction.confidenceScore >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                    {tomorrowPrediction.confidenceScore}%
                  </p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <PredCard icon="��" label="Predicted Sold" value={`${tomorrowPrediction.predictedBagelsSold}`} />
              <PredCard icon="🔥" label="Recommended Production" value={`${tomorrowPrediction.recommendedBagelsToBake}`} highlight />
              <PredCard icon="📦" label="Predicted Remaining" value={`${tomorrowPrediction.predictedLeftovers}`} />
              {tomorrowPrediction.projectedSellThroughRate != null && (
                <PredCard icon="📈" label="Estimated Sell-through Rate" value={`${(tomorrowPrediction.projectedSellThroughRate * 100).toFixed(1)}%`} />
              )}
            </div>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Link href={`/predictions/${tomorrowPrediction.id}`} className="text-sm text-blue-700 hover:underline font-medium">
                View Details →
              </Link>
              <span className="text-gray-300">|</span>
              <Link href={`/predictions/new`} className="text-sm text-blue-600 hover:underline">
                Recalculate
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-6 flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">No prediction yet for tomorrow ({tomorrowStr}).</p>
              <p className="text-gray-400 text-xs mt-1">Create a prediction now to get a production recommendation.</p>
            </div>
            <Link
              href={`/predictions/new`}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium whitespace-nowrap"
            >
              🔮 Create Tomorrow&apos;s Prediction
            </Link>
          </div>
        )}
      </div>

      {/* Recent Performance Summary */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">📊 Recent 7-Day Performance</h2>
        {recentRecords.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard title="7-Day Total Sales" value={formatCurrency(totalSalesSum)} sub={`${recentRecords.length} days recorded`} />
            <StatCard title="Daily Avg. Sales" value={formatCurrency(avgDailySales)} sub="recent 7-day baseline" />
            <StatCard title="Daily Avg. Sold" value={`${Math.round(avgBagelsSold)}`} sub="bagels" />
            <StatCard
              title="Avg. Waste Rate"
              value={`${(avgWasteRate * 100).toFixed(1)}%`}
              sub="bagel baseline"
              highlight={avgWasteRate > 0.1}
            />
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 text-center">
            <p className="text-gray-400 text-sm">No sales data for the recent 7 days.</p>
            <Link href="/sales/new" className="mt-2 inline-block text-sm text-amber-600 hover:underline">
              Enter Sales →
            </Link>
          </div>
        )}
      </div>

      {/* Prediction Accuracy */}
      {comparableCount > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">🎯 recent Predictions Accuracy</h2>
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">recent {comparableCount} items available for comparison</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {accurateCount}items accurate <span className="text-lg font-normal text-gray-500">/ {comparableCount}items</span>
                </p>
                <p className="text-sm text-gray-500 mt-1">Error rate within 5% baseline</p>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-bold ${accuracyRate != null && accuracyRate >= 60 ? "text-green-600" : accuracyRate != null && accuracyRate >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                  {accuracyRate ?? "-"}%
                </div>
                <Link href="/predictions/performance" className="text-sm text-blue-600 hover:underline mt-1 block">
                  Performance Details →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Summary */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">📊 Analytics Summary</h2>
          <Link href="/analytics" className="text-sm text-amber-600 hover:underline">
            Analytics Details →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 7-day comparison */}
          {week7Comparison && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 mb-3">Last 7 days vs. previous 7 days</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Sales</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrencyNZD(week7Comparison.current.totalSales)}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        week7Comparison.salesChangePercent > 0
                          ? "text-green-600"
                          : week7Comparison.salesChangePercent < 0
                          ? "text-red-600"
                          : "text-gray-500"
                      }`}
                    >
                      {week7Comparison.salesChangePercent > 0 ? "▲ +" : week7Comparison.salesChangePercent < 0 ? "▼ " : ""}
                      {week7Comparison.salesChangePercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Daily Avg. Sales</span>
                  <span className="text-sm font-medium text-gray-700">
                    {formatCurrencyNZD(week7Comparison.current.averageDailySales)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Avg. Waste Rate</span>
                  <span
                    className={`text-sm font-medium ${
                      week7Comparison.current.wasteRate > 0.1 ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {(week7Comparison.current.wasteRate * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* This month vs last month */}
          {monthComparison && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 mb-3">This month vs. last month</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">This Month Sales</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrencyNZD(monthComparison.current.totalSales)}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        monthComparison.salesChangePercent > 0
                          ? "text-green-600"
                          : monthComparison.salesChangePercent < 0
                          ? "text-red-600"
                          : "text-gray-500"
                      }`}
                    >
                      {monthComparison.salesChangePercent > 0 ? "▲ +" : monthComparison.salesChangePercent < 0 ? "▼ " : ""}
                      {monthComparison.salesChangePercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Last Month Sales</span>
                  <span className="text-sm font-medium text-gray-500">
                    {formatCurrencyNZD(monthComparison.previous.totalSales)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">This Month Records</span>
                  <span className="text-sm font-medium text-gray-700">
                    {monthComparison.current.recordCount} days
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {!week7Comparison && !monthComparison && (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-center text-sm text-gray-400">
            No analytics data..{" "}
            <Link href="/sales/new" className="text-amber-600 hover:underline">
              Enter Sales →
            </Link>
          </div>
        )}
      </div>

      {/* Recent Records Table */}
      {recentRecords.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">recent Sales Records</h2>
            <Link href="/sales" className="text-sm text-amber-600 hover:underline">View All →</Link>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Sales</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sold</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Remaining</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Waste Rate</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentRecords.slice(0, 5).map((record) => {
                  const wasteRate = getWasteRate(record);
                  return (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <Link href={`/sales/${record.id}`} className="hover:text-amber-700 font-medium">
                          {formatDate(record.date)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(getTotalSales(record))}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{getSoldBagels(record)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{record.bagelsLeft}</td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${wasteRate > 0.1 ? "text-red-600" : "text-green-600"}`}>
                        {(wasteRate * 100).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recentRecords.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">🥯</p>
          <p className="text-gray-500 mb-4">No sales data entered yet.</p>
          <Link
            href="/sales/new"
            className="inline-flex items-center px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors"
          >
            Enter First Sales Record
          </Link>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  highlight,
}: {
  title: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-5 ${highlight ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${highlight ? "text-red-700" : "text-gray-900"}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function PredCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: string;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg p-3 text-center ${highlight ? "bg-blue-100 border border-blue-300" : "bg-white border border-blue-100"}`}>
      <div className="text-xl mb-1">{icon}</div>
      <p className="text-xs text-blue-600">{label}</p>
      <p className={`text-base font-bold mt-0.5 ${highlight ? "text-blue-900" : "text-blue-700"}`}>{value}</p>
    </div>
  );
}

function QuickAction({
  href,
  label,
  icon,
  color,
}: {
  href: string;
  label: string;
  icon: string;
  color: "amber" | "purple" | "blue" | "green" | "gray";
}) {
  const hover = {
    amber: "hover:bg-amber-50 hover:border-amber-200",
    purple: "hover:bg-purple-50 hover:border-purple-200",
    blue: "hover:bg-blue-50 hover:border-blue-200",
    green: "hover:bg-green-50 hover:border-green-200",
    gray: "hover:bg-gray-50 hover:border-gray-300",
  }[color];
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 rounded-lg transition-colors ${hover}`}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-medium text-gray-700 text-center leading-tight">{label}</span>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    imported: "bg-purple-100 text-purple-700",
    ready: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    pending: "bg-gray-100 text-gray-700",
    validating: "bg-yellow-100 text-yellow-700",
  };
  const label: Record<string, string> = {
    imported: "Imported",
    ready: "Ready",
    failed: "Failed",
    pending: "Pending",
    validating: "Validating",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-700"}`}>
      {label[status] ?? status}
    </span>
  );
}
