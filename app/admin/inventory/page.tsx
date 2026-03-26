export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import Link from "next/link";
import InventoryManager from "./InventoryManager";

export default async function InventoryPage() {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/admin" className="hover:text-amber-600 transition-colors">
            관리자 대시보드
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">일별 재고 관리</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">일별 재고 관리</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          날짜별 상품 생산량 및 재고 현황을 관리합니다
        </p>
      </div>
      <InventoryManager />
    </div>
  );
}
