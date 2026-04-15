export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { getIngredientById, listIngredientCategories } from "@/lib/services/ingredientService";
import { buildIngredientHistoryViewModel } from "@/lib/costing/ingredient-price-history";
import Link from "next/link";
import { notFound } from "next/navigation";
import IngredientForm from "../../IngredientForm";
import IngredientPriceHistoryTable from "../../IngredientPriceHistoryTable";

export default async function EditIngredientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [ingredient, categories, historyVm] = await Promise.all([
    getIngredientById(id),
    listIngredientCategories(),
    buildIngredientHistoryViewModel(id),
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

          {ingredient.lastPriceUpdatedAt && (
            <>
              <dt className="text-gray-500">Last Price Update</dt>
              <dd className="text-gray-700 text-xs">
                {new Date(ingredient.lastPriceUpdatedAt).toLocaleString("en-NZ")}
                {ingredient.lastPriceDelta !== null && (() => {
                  const delta = parseFloat(ingredient.lastPriceDelta!);
                  return (
                    <span className={`ml-2 font-mono ${delta > 0 ? "text-red-600" : delta < 0 ? "text-green-600" : "text-gray-500"}`}>
                      {delta > 0 ? "+" : ""}${Math.abs(delta).toFixed(2)}
                      {ingredient.lastPriceDeltaPct !== null && (
                        <span className="ml-1 text-gray-400">
                          ({delta > 0 ? "+" : ""}{ingredient.lastPriceDeltaPct}%)
                        </span>
                      )}
                    </span>
                  );
                })()}
              </dd>
            </>
          )}
        </dl>
      </div>

      <IngredientForm ingredient={ingredient} categories={categories} />

      {/* Supplier Links Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Supplier Links</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage suppliers linked to this ingredient
            </p>
          </div>
          <Link
            href={`/ingredients/${ingredient.id}/suppliers`}
            className="text-sm text-amber-600 hover:underline"
          >
            Manage suppliers →
          </Link>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          {ingredient.supplierLinkCount === 0 ? (
            <p className="text-sm text-gray-400 italic">No supplier links yet.</p>
          ) : (
            <p className="text-sm text-gray-700">
              <span className="font-medium">{ingredient.supplierLinkCount}</span> active{" "}
              {ingredient.supplierLinkCount === 1 ? "link" : "links"}
              {ingredient.primarySupplierName && (
                <span className="text-gray-500">
                  {" "}· Primary:{" "}
                  <span className="text-amber-700 font-medium">
                    {ingredient.primarySupplierName}
                  </span>
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Price History Section */}
      <div className="space-y-3 max-w-full">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Price History</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Historical record of costing changes — {historyVm.rows.length}{" "}
            {historyVm.rows.length === 1 ? "entry" : "entries"}
          </p>
        </div>
        <div className="w-full">
          <IngredientPriceHistoryTable rows={historyVm.rows} />
        </div>
      </div>
    </div>
  );
}
