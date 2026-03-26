export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import Link from "next/link";
import ProductionDatePicker from "./ProductionDatePicker";

export default async function ProductionPage() {
  await requireAdmin();

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/admin" className="hover:text-amber-600 transition-colors">
            관리자 대시보드
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">생산량 추천</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">생산량 추천 엔진</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          날짜별 주문·구독·예측 데이터를 기반으로 최적 생산량을 추천합니다
        </p>
      </div>
      <ProductionDatePicker today={today} />
    </div>
  );
}
