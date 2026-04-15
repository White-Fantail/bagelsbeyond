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

      {/* Cost Summary Block */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Costing Summary
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-gray-500">Purchase Price</dt>
          <dd className="text-gray-900 font-mono font-medium">${ingredient.purchasePrice}</dd>

          <dt className="text-gray-500">Purchase Quantity</dt>
          <dd className="text-gray-900 font-mono">
            {ingredient.purchaseQuantity}{" "}
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 ml-1">
              {ingredient.purchaseUnit}
            </span>
          </dd>

          <dt className="text-gray-500">Base Unit</dt>
          <dd>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
              {ingredient.baseUnit}
            </span>
          </dd>

          <dt className="text-gray-500">Converted Base Qty</dt>
          <dd className="text-gray-900 font-mono">
            {ingredient.convertedBaseQuantity ?? (
              <span className="text-gray-400 italic text-xs">Unsupported</span>
            )}
          </dd>

          <dt className="text-gray-500">Standard Cost / Base Unit</dt>
          <dd className="text-gray-900 font-mono font-medium">
            {ingredient.standardUnitDisplay ?? (
              <span className="text-gray-400 italic text-xs">Unsupported</span>
            )}
          </dd>

          <dt className="text-gray-500">Conversion Status</dt>
          <dd>
            {ingredient.conversionStatus === "ok" ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                OK
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                Unsupported
              </span>
            )}
          </dd>
        </dl>
      </div>

      <IngredientForm ingredient={ingredient} categories={categories} />
    </div>
  );
}
