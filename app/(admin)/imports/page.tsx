export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:    { label: "Pending", color: "bg-yellow-100 text-yellow-700" },
  validating: { label: "Validating", color: "bg-blue-100 text-blue-700" },
  ready:      { label: "Ready", color: "bg-green-100 text-green-700" },
  imported:   { label: "Imported", color: "bg-purple-100 text-purple-700" },
  failed:     { label: "Failed",     color: "bg-red-100 text-red-700" },
};

async function getImportJobs() {
  try {
    return await prisma.importJob.findMany({
      orderBy: { createdAt: "desc" },
      include: { rows: { select: { id: true, status: true } } },
    });
  } catch {
    return [];
  }
}

export default async function ImportsPage() {
  const jobs = await getImportJobs();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CSV Imports</h1>
          <p className="text-gray-500 mt-1">Internal Sales Data CSV Import ({jobs.length} items)</p>
        </div>
        <Link
          href="/imports/new"
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
        >
          + New CSV Import
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">📂</p>
          <p className="text-gray-500 mb-4">No import tasks yet.</p>
          <Link
            href="/imports/new"
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            Upload First CSV File
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">File Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Rows</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Success</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Failed</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {jobs.map((job) => {
                const statusInfo = STATUS_LABELS[job.status] ?? { label: job.status, color: "bg-gray-100 text-gray-700" };
                return (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      <Link href={`/imports/${job.id}`} className="hover:text-purple-700">
                        {job.fileName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 text-right">{job.totalRows}</td>
                    <td className="px-4 py-3 text-sm text-green-600 text-right">{job.successRows}</td>
                    <td className="px-4 py-3 text-sm text-red-500 text-right">{job.failedRows}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(job.createdAt)}</td>
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
