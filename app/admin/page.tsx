import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function AdminPage() {
  const session = await requireAdmin();

  const [userCount, recordCount, productCount, inventoryCount, orderCount] = await Promise.all([
    prisma.user.count(),
    prisma.dailyRecord.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.dailyInventory.count(),
    prisma.order.count(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
        <p className="text-gray-500 mt-1">안녕하세요, {session.name}님 (ADMIN)</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">전체 사용자</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{userCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">매출 기록 수</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{recordCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-100 p-5">
          <p className="text-sm text-amber-600">활성 상품</p>
          <p className="text-3xl font-bold text-amber-700 mt-1">{productCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">재고 입력 수</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{inventoryCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-100 p-5">
          <p className="text-sm text-blue-600">전체 주문</p>
          <p className="text-3xl font-bold text-blue-700 mt-1">{orderCount}</p>
        </div>
      </div>

      {/* Quick links */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="font-semibold text-gray-900">관리자 전용 메뉴</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <Link href="/admin/orders" className="text-amber-600 hover:underline">
              → 주문 관리 (픽업 주문 조회·상태 변경)
            </Link>
          </li>
          <li>
            <Link href="/admin/integrations" className="text-amber-600 hover:underline">
              → 외부 연동 (Loyverse POS 카탈로그 동기화)
            </Link>
          </li>
          <li>
            <Link href="/admin/users" className="text-amber-600 hover:underline">
              → 사용자 관리 (권한·활성 상태 변경)
            </Link>
          </li>
          <li>
            <Link href="/admin/products" className="text-amber-600 hover:underline">
              → 상품 관리 (상품·옵션 등록 및 수정)
            </Link>
          </li>
          <li>
            <Link href="/admin/inventory" className="text-amber-600 hover:underline">
              → 일별 재고 관리 (생산량·판매량 입력)
            </Link>
          </li>
          <li>
            <Link href="/admin/production" className="text-amber-600 hover:underline">
              → 생산량 추천 엔진 (주문·구독·예측 기반 최적 생산량)
            </Link>
          </li>
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
