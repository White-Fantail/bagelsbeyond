export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { listProductCategories } from "@/lib/services/menuProductService";
import {
  moveFreshnessCategoryAction,
  toggleFreshnessManagedCategoryAction,
} from "@/app/actions/freshness";
import FreshnessCategoryControls from "@/components/FreshnessCategoryControls";

export default async function FreshnessCategoriesPage() {
  await requireAdmin();

  const categories = await listProductCategories();

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
            <Link href="/freshness" className="hover:text-amber-600 transition-colors">
              Freshness
            </Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">Category Settings</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Freshness Category Settings</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Configure which categories are freshness-managed and adjust their display order.
          </p>
        </div>
      </div>

      {/* Category controls */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Category Controls</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Toggle freshness management on/off per category and reorder them using the arrow buttons.
          </p>
        </div>
        <FreshnessCategoryControls
          categories={categories}
          onToggleCategoryManaged={toggleFreshnessManagedCategoryAction}
          onMoveCategory={moveFreshnessCategoryAction}
        />
      </div>
    </div>
  );
}
