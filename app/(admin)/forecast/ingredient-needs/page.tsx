export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { buildProductionPlan } from "@/lib/planning/ingredient-needs";

function fmtQty(n: number, unit: string): string {
  return `${n.toLocaleString("en-NZ", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${unit}`;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function IngredientNeedsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const targetDate = params.date ?? todayStr();

  let plan: Awaited<ReturnType<typeof buildProductionPlan>> | null = null;
  let error: string | null = null;

  try {
    plan = await buildProductionPlan(targetDate);
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : "Failed to load plan";
  }

  const rawIngredients = plan ? [...plan.bomResult.rawIngredients.values()] : [];
  const componentRequirements = plan ? [...plan.bomResult.componentRequirements.values()] : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/dashboard" className="hover:text-amber-600 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href={`/forecast/production-plan?date=${targetDate}`} className="hover:text-amber-600 transition-colors">
            Production Plan
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Ingredient Needs</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Ingredient Needs</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          Raw ingredient and component requirements for the target date production plan.
        </p>
      </div>

      {/* Date selector */}
      <form method="GET" className="flex items-center gap-3">
        <label htmlFor="date" className="text-sm font-medium text-gray-700">Target Date</label>
        <input
          id="date"
          name="date"
          type="date"
          defaultValue={targetDate}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          type="submit"
          className="px-4 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-sm font-medium transition-colors"
        >
          Load
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {plan && (
        <>
          {/* Component Requirements */}
          <section>
            <h2 className="text-base font-semibold text-gray-700 mb-3">
              Component Requirements
            </h2>
            {componentRequirements.length === 0 ? (
              <p className="text-sm text-gray-400">No reusable component requirements for this plan.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Component Product</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Required Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {componentRequirements.map((comp) => (
                      <tr key={comp.productId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{comp.productName}</td>
                        <td className="px-4 py-3 text-right text-amber-700 font-semibold">
                          {comp.quantity.toLocaleString("en-NZ", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{comp.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Raw Ingredient Requirements */}
          <section>
            <h2 className="text-base font-semibold text-gray-700 mb-3">
              Raw Ingredient Requirements
            </h2>
            {rawIngredients.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                <p className="text-4xl mb-3">🧾</p>
                <p className="text-gray-700 font-medium mb-1">No ingredient requirements calculated.</p>
                <p className="text-sm text-gray-500">
                  Set forecast quantities for plannable products to generate ingredient needs.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ingredient</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Recipe Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-amber-600 uppercase">Required Qty (Yield-Adj)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rawIngredients
                      .sort((a, b) => b.effectiveQuantity - a.effectiveQuantity)
                      .map((ing) => (
                        <tr key={ing.ingredientId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            <Link
                              href={`/ingredients/${ing.ingredientId}`}
                              className="hover:text-amber-600 transition-colors"
                            >
                              {ing.ingredientName}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500">
                            {fmtQty(ing.recipeQuantity, ing.baseUnit)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-amber-700">
                            {fmtQty(ing.effectiveQuantity, ing.baseUnit)}
                          </td>
                          <td className="px-4 py-3 text-gray-500">{ing.baseUnit}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Notes */}
          <section className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-800 mb-1">About Yield Adjustment</p>
            <p className="text-sm text-blue-700">
              <strong>Required Qty</strong> is the yield-adjusted quantity — the actual amount of
              raw ingredient you need to purchase or prepare, accounting for waste or trim loss
              defined in each ingredient's yield percentage.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
