export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { getIngredientById } from "@/lib/services/ingredientService";
import { listIngredientSupplierLinks } from "@/lib/services/supplierService";
import Link from "next/link";
import { notFound } from "next/navigation";
import IngredientSupplierLinksTable from "./IngredientSupplierLinksTable";

export default async function IngredientSuppliersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [ingredient, links] = await Promise.all([
    getIngredientById(id),
    listIngredientSupplierLinks(id),
  ]);

  if (!ingredient) notFound();

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
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
            <Link
              href={`/ingredients/${id}/edit`}
              className="hover:text-amber-600 transition-colors"
            >
              {ingredient.name}
            </Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">Suppliers</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Links</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Manage supplier mappings for {ingredient.name}
          </p>
        </div>
        <Link
          href={`/ingredients/${id}/suppliers/new`}
          className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 transition-colors flex-shrink-0"
        >
          + Add Supplier Link
        </Link>
      </div>

      {/* Ingredient summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Ingredient Summary
        </h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm">
          <dt className="text-gray-500">Category</dt>
          <dd className="text-gray-900">{ingredient.categoryName ?? "—"}</dd>

          <dt className="text-gray-500">Purchase Price</dt>
          <dd className="text-gray-900 font-mono">${ingredient.purchasePrice}</dd>

          <dt className="text-gray-500">Purchase Qty</dt>
          <dd className="text-gray-900 font-mono">
            {ingredient.purchaseQuantity} {ingredient.purchaseUnit}
          </dd>

          <dt className="text-gray-500">Base Unit</dt>
          <dd className="text-gray-900">{ingredient.baseUnit}</dd>

          <dt className="text-gray-500">Standard Cost</dt>
          <dd className="text-gray-900 font-mono">
            {ingredient.standardUnitDisplay ?? "—"}
          </dd>

          <dt className="text-gray-500">Status</dt>
          <dd>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                ingredient.isActive
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {ingredient.isActive ? "Active" : "Inactive"}
            </span>
          </dd>
        </dl>
      </div>

      {/* Links table */}
      <IngredientSupplierLinksTable links={links} ingredientId={id} />
    </div>
  );
}
