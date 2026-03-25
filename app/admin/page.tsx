import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function AdminPage() {
  const session = await requireAdmin();

  // Example: fetch user count
  const userCount = await prisma.user.count();
  const recordCount = await prisma.dailyRecord.count();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
        <p className="text-gray-500 mt-1">안녕하세요, {session.name}님 (ADMIN)</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">전체 사용자</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{userCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">매출 기록 수</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{recordCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">접근 권한</p>
          <p className="text-lg font-semibold text-amber-600 mt-1">ADMIN (전체)</p>
        </div>
      </div>

      {/* Quick links */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="font-semibold text-gray-900">관리자 전용 메뉴</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <Link href="/analytics" className="text-amber-600 hover:underline">
              → 전체 매출 분석 (ADMIN 전용)
            </Link>
          </li>
          <li>
            <Link href="/sales" className="text-amber-600 hover:underline">
              → 매출 목록
            </Link>
          </li>
          <li>
            <Link href="/weights" className="text-amber-600 hover:underline">
              → 가중치 관리
            </Link>
          </li>
          <li>
            <Link href="/settings" className="text-amber-600 hover:underline">
              → 앱 설정
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
