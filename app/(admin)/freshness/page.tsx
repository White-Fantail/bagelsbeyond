export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { getFreshnessDashboard } from "@/lib/services/freshnessService";
import { listMenuProducts } from "@/lib/services/menuProductService";
import FreshnessDashboard from "@/components/FreshnessDashboard";
import { createFreshnessLogAction } from "@/app/actions/freshness";

export default async function FreshnessPage() {
  await requireAdmin();

  const [items, products] = await Promise.all([
    getFreshnessDashboard(),
    listMenuProducts({ isActive: true }),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/dashboard" className="hover:text-amber-600 transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">신선도 관리</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">신선도 관리</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            제품별 디스플레이 경과일 및 신선도 상태를 확인하세요.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/freshness/logs"
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            로그 이력
          </Link>
        </div>
      </div>

      <FreshnessDashboard
        items={items}
        products={products}
        onAddLog={createFreshnessLogAction}
      />
    </div>
  );
}
