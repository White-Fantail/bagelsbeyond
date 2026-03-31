export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import type { DailyExternalFactor } from "@/types";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-NZ", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

export default async function ExternalFactorsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;

  const where: Record<string, unknown> = {};
  if (sp.from || sp.to) {
    where.date = {
      ...(sp.from ? { gte: new Date(sp.from + "T00:00:00.000Z") } : {}),
      ...(sp.to ? { lte: new Date(sp.to + "T23:59:59.999Z") } : {}),
    };
  }

  const factors = await prisma.dailyExternalFactor.findMany({
    where,
    orderBy: { date: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">External Data management</h1>
          <p className="text-gray-500 mt-1">External factors data auto-collected by date</p>
        </div>
        <CollectTodayButton />
      </div>

      {/* Date filter */}
      <FilterForm from={sp.from} to={sp.to} />

      {factors.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-lg">📭</p>
          <p className="text-gray-500 mt-2">No external data collected.</p>
          <p className="text-gray-400 text-sm mt-1">Auto-collected on new Sales Records or Predictions.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Weather</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Holiday</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">School Holiday</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Event</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Collected At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {factors.map((f: DailyExternalFactor) => {
                const dateStr = new Date(f.date).toISOString().split("T")[0];
                return (
                  <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/external-factors/${dateStr}`}
                        className="text-amber-600 hover:underline font-medium"
                      >
                        {formatDate(new Date(f.date))}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {f.weatherSummary ? (
                        <span>
                          {f.weatherSummary}
                          {f.maxTemp != null && (
                            <span className="text-gray-400 ml-1 text-xs">
                              {f.minTemp}–{f.maxTemp}°C
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {f.holidayName ? (
                        <span className="text-blue-600 font-medium">{f.holidayName}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {f.schoolHoliday ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">School Holiday</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {f.localEventName ? (
                        <span className="text-purple-600">{f.localEventName}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {f.collectedAt
                        ? new Date(f.collectedAt).toLocaleDateString("en-NZ")
                        : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterForm({ from, to }: { from?: string; to?: string }) {
  return (
    <form method="GET" className="flex items-end gap-3 bg-white rounded-lg border border-gray-200 p-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
        <input
          type="date"
          name="from"
          defaultValue={from ?? ""}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900 bg-white"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
        <input
          type="date"
          name="to"
          defaultValue={to ?? ""}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900 bg-white"
        />
      </div>
      <button
        type="submit"
        className="px-4 py-1.5 bg-amber-500 text-white rounded-md text-sm hover:bg-amber-600 transition-colors"
      >
        Filter
      </button>
      {(from || to) && (
        <Link href="/external-factors" className="px-4 py-1.5 border border-gray-300 text-gray-600 rounded-md text-sm hover:bg-gray-50 transition-colors">
          Reset
        </Link>
      )}
    </form>
  );
}

function CollectTodayButton() {
  // Client component interaction handled via link to detail page
  const today = new Date().toISOString().split("T")[0];
  return (
    <Link
      href={`/external-factors/${today}`}
      className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors font-medium"
    >
      View/Collect Today&apos;s Data
    </Link>
  );
}
