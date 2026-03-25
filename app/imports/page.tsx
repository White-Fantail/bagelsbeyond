import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "대기중", color: "bg-yellow-100 text-yellow-700" },
  processing: { label: "처리중", color: "bg-blue-100 text-blue-700" },
  completed: { label: "완료", color: "bg-green-100 text-green-700" },
  failed: { label: "실패", color: "bg-red-100 text-red-700" },
  reviewed: { label: "검토완료", color: "bg-purple-100 text-purple-700" },
};

async function getImportJobs() {
  try {
    return await prisma.ocrImportJob.findMany({
      orderBy: { createdAt: "desc" },
      include: { items: true },
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
          <h1 className="text-2xl font-bold text-gray-900">OCR 가져오기</h1>
          <p className="text-gray-500 mt-1">이미지 업로드로 과거 기록 불러오기 ({jobs.length}건)</p>
        </div>
        <Link
          href="/imports/new"
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
        >
          + 새 가져오기
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">📷</p>
          <p className="text-gray-500 mb-4">아직 가져오기 작업이 없습니다.</p>
          <Link
            href="/imports/new"
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            첫 번째 파일 업로드
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">파일명</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">항목수</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">생성일</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {jobs.map((job) => {
                const statusInfo = STATUS_LABELS[job.status] ?? { label: job.status, color: "bg-gray-100 text-gray-700" };
                const approvedCount = job.items.filter((i) => i.reviewStatus === "approved").length;
                return (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      <Link href={`/imports/${job.id}`} className="hover:text-purple-700">
                        {job.sourceFileName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 text-right">
                      {job.items.length}건
                      {approvedCount > 0 && (
                        <span className="ml-1 text-green-600">({approvedCount} 승인)</span>
                      )}
                    </td>
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
