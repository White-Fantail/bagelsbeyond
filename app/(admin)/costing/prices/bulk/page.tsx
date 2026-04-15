export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { listIngredients } from "@/lib/services/ingredientService";
import Link from "next/link";
import BulkPriceUpdateClient from "./BulkPriceUpdateClient";

export default async function BulkPriceUpdatePage() {
  await requireAdmin();

  const ingredients = await listIngredients({ isActive: true });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/dashboard" className="hover:text-amber-600 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/ingredients" className="hover:text-amber-600 transition-colors">Ingredients</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Bulk Price Update</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Bulk Price Update</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          Edit pricing for multiple ingredients and save in one action.
        </p>
      </div>

      <BulkPriceUpdateClient ingredients={ingredients} />
    </div>
  );
}
