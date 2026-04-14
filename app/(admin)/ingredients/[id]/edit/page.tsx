export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { getIngredientById, listIngredientCategories } from "@/lib/services/ingredientService";
import Link from "next/link";
import { notFound } from "next/navigation";
import IngredientForm from "../../IngredientForm";

export default async function EditIngredientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [ingredient, categories] = await Promise.all([
    getIngredientById(id),
    listIngredientCategories(),
  ]);

  if (!ingredient) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
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
          <span className="text-gray-700 font-medium">Edit</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Ingredient</h1>
        <p className="text-gray-500 mt-0.5 text-sm">{ingredient.name}</p>
      </div>

      <IngredientForm ingredient={ingredient} categories={categories} />
    </div>
  );
}
