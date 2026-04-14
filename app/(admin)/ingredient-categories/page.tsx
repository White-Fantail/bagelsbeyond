export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { listIngredientCategories } from "@/lib/services/ingredientService";
import Link from "next/link";
import IngredientCategoriesManager from "./IngredientCategoriesManager";

export default async function IngredientCategoriesPage() {
  await requireAdmin();
  const categories = await listIngredientCategories();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/dashboard" className="hover:text-amber-600 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/ingredients" className="hover:text-amber-600 transition-colors">
            Ingredients
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Categories</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Ingredient Categories</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          Manage ingredient categories for organisation
        </p>
      </div>

      <IngredientCategoriesManager initialCategories={categories} />
    </div>
  );
}
