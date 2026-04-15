export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { getMenuProductById } from "@/lib/services/menuProductService";
import { listComponentProducts } from "@/lib/services/menuProductService";
import { getRecipeCostSummary } from "@/lib/services/recipeService";
import { listIngredients } from "@/lib/services/ingredientService";
import { getGlobalPricingSettings, buildPricingSummaryForProduct } from "@/lib/services/pricingService";
import { notFound } from "next/navigation";
import Link from "next/link";
import RecipeManager from "./RecipeManager";
import RecipePricingSummary from "./RecipePricingSummary";
import { PricingTargetType } from "@/app/generated/prisma/enums";

export default async function RecipePage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  await requireAdmin();
  const { productId } = await params;

  const [product, summary, activeIngredients, componentProducts, globalPricingSettings] = await Promise.all([
    getMenuProductById(productId),
    getRecipeCostSummary(productId),
    listIngredients({ isActive: true }),
    listComponentProducts(),
    getGlobalPricingSettings(),
  ]);

  if (!product) notFound();

  const adjustedCostPerUnit =
    summary?.adjustedCostPerOutputUnit != null ? parseFloat(summary.adjustedCostPerOutputUnit) : null;

  const pricingSummary = buildPricingSummaryForProduct(product, adjustedCostPerUnit, globalPricingSettings);

  // Build human-readable target label
  const effectiveTarget = pricingSummary.effectiveTarget;
  let targetLabel = "No target";
  if (effectiveTarget) {
    const typeLabel =
      effectiveTarget.targetType === PricingTargetType.COST_PERCENT ? "Cost %" : "Margin %";
    const overrideNote = effectiveTarget.isOverride ? " (product override)" : " (global default)";
    targetLabel = `${effectiveTarget.targetPercent}% ${typeLabel}${overrideNote}`;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb & header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/dashboard" className="hover:text-amber-600 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/products" className="hover:text-amber-600 transition-colors">
            Products
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">{product.name}</span>
          <span>/</span>
          <span className="text-gray-700 font-medium">Recipe</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
        <p className="text-gray-500 mt-0.5 text-sm">Recipe & ingredient costing</p>
      </div>

      <RecipeManager
        product={product}
        initialSummary={summary}
        activeIngredients={activeIngredients}
        componentProducts={componentProducts}
      />

      {/* Pricing summary — only show when there's something meaningful to display */}
      <RecipePricingSummary pricing={pricingSummary} targetLabel={targetLabel} summary={summary} />
    </div>
  );
}
