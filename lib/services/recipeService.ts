import "server-only";
import { prisma } from "@/lib/db";
import { UnitType, RecipeItemSourceType } from "@/app/generated/prisma/enums";
import type { Prisma } from "@/app/generated/prisma/client";
import { calculateStandardUnitCost } from "@/lib/costing/ingredient-cost";
import {
  calculateRecipeItemCost,
  calculateRecipeTotalCost,
  calculateEffectiveQuantity,
  calculateAdjustedLineCost,
  calculateCostPerOutputUnit,
  calculateComponentProductLineCost,
} from "@/lib/costing/recipe-cost";

export { calculateRecipeItemCost, calculateRecipeTotalCost };

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecipeRow = {
  id: string;
  productId: string;
  name: string;
  isActive: boolean;
  outputQuantity: string;
  outputUnit: UnitType;
  createdAt: string;
  updatedAt: string;
};

export type RecipeItemRow = {
  id: string;
  recipeId: string;
  sourceType: RecipeItemSourceType;
  // INGREDIENT source fields
  ingredientId: string | null;
  ingredientName: string | null;
  ingredientBaseUnit: UnitType | null;
  /** Standard unit cost in $, null if costing not available */
  ingredientStandardUnitCost: string | null;
  /** Yield percentage from the ingredient master (e.g. "85.00") */
  yieldPercent: string | null;
  /** Effective quantity after yield adjustment */
  effectiveQuantity: string | null;
  // PRODUCT source fields
  componentProductId: string | null;
  componentProductName: string | null;
  /** Per-unit cost of the component product, null if unavailable */
  componentProductUnitCost: string | null;
  // Common fields
  quantity: string;
  unit: UnitType;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  /** Derived: direct line cost (no yield for ingredients), null if cost unavailable */
  directLineCost: string | null;
  /** Derived: yield-adjusted line cost (same as directLineCost for product items), null if cost unavailable */
  adjustedLineCost: string | null;
  /** @deprecated Use directLineCost instead. Kept for backward compatibility. */
  lineCost: string | null;
};

export type RecipeCostSummary = {
  recipe: RecipeRow;
  items: RecipeItemRow[];
  /** Sum of direct line costs (no yield adjustment), null if any ingredient has no standard cost */
  batchDirectTotalCost: string | null;
  /** Sum of yield-adjusted line costs, null if any ingredient has no standard cost */
  batchAdjustedTotalCost: string | null;
  /** Cost per output unit based on direct total cost */
  directCostPerOutputUnit: string | null;
  /** Cost per output unit based on adjusted total cost */
  adjustedCostPerOutputUnit: string | null;
  /** Output quantity for this batch */
  outputQuantity: string;
  /** Output unit for this batch */
  outputUnit: UnitType;
  /** true when every item has a valid standard unit cost */
  isFullyCosted: boolean;
  // Backward-compat aliases
  /** @deprecated Use batchDirectTotalCost. */
  directTotalCost: string | null;
  /** @deprecated Use batchAdjustedTotalCost. */
  adjustedTotalCost: string | null;
  /** @deprecated Use batchDirectTotalCost. */
  totalCost: string | null;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

type RawIngredient = {
  id: string;
  name: string;
  baseUnit: UnitType;
  purchasePrice: Prisma.Decimal;
  purchaseQuantity: Prisma.Decimal;
  purchaseUnit: UnitType;
  yieldPercent: Prisma.Decimal;
};

function getStandardUnitCost(ingredient: RawIngredient): number | null {
  const price = parseFloat(ingredient.purchasePrice.toString());
  const qty = parseFloat(ingredient.purchaseQuantity.toString());
  const result = calculateStandardUnitCost(price, qty, ingredient.purchaseUnit, ingredient.baseUnit);
  return result.isConvertible ? result.standardUnitCost : null;
}

type RawRecipeItem = {
  id: string;
  recipeId: string;
  sourceType: RecipeItemSourceType;
  ingredientId: string | null;
  componentProductId: string | null;
  quantity: Prisma.Decimal;
  unit: UnitType;
  notes: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  ingredient: RawIngredient | null;
  componentProduct: {
    id: string;
    name: string;
  } | null;
};

/**
 * Gets the per-unit recipe cost for a component product.
 * Returns null if the product has no active recipe or costing is incomplete.
 */
async function getComponentProductUnitCost(productId: string): Promise<number | null> {
  const summary = await getRecipeCostSummary(productId);
  if (!summary) return null;
  const adjustedCostPerUnit = summary.adjustedCostPerOutputUnit;
  if (!adjustedCostPerUnit) return null;
  return parseFloat(adjustedCostPerUnit);
}

function toRecipeItemRow(r: RawRecipeItem, componentUnitCost: number | null = null): RecipeItemRow {
  const quantity = parseFloat(r.quantity.toString());

  if (r.sourceType === RecipeItemSourceType.INGREDIENT && r.ingredient) {
    const yieldPct = parseFloat(r.ingredient.yieldPercent.toString());
    const standardUnitCost = getStandardUnitCost(r.ingredient);
    const effectiveQty = calculateEffectiveQuantity(quantity, yieldPct);
    const directCost = calculateRecipeItemCost(quantity, standardUnitCost);
    const adjustedCost = calculateAdjustedLineCost(quantity, yieldPct, standardUnitCost);

    return {
      id: r.id,
      recipeId: r.recipeId,
      sourceType: r.sourceType,
      ingredientId: r.ingredientId,
      ingredientName: r.ingredient.name,
      ingredientBaseUnit: r.ingredient.baseUnit,
      ingredientStandardUnitCost: standardUnitCost !== null ? standardUnitCost.toFixed(6) : null,
      yieldPercent: yieldPct.toFixed(2),
      effectiveQuantity: effectiveQty.toFixed(3),
      componentProductId: null,
      componentProductName: null,
      componentProductUnitCost: null,
      quantity: r.quantity.toFixed(3),
      unit: r.unit,
      notes: r.notes,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      directLineCost: directCost !== null ? directCost.toFixed(4) : null,
      adjustedLineCost: adjustedCost !== null ? adjustedCost.toFixed(4) : null,
      lineCost: directCost !== null ? directCost.toFixed(4) : null,
    };
  }

  // PRODUCT source type
  const directCost = calculateComponentProductLineCost(quantity, componentUnitCost);

  return {
    id: r.id,
    recipeId: r.recipeId,
    sourceType: r.sourceType,
    ingredientId: null,
    ingredientName: null,
    ingredientBaseUnit: null,
    ingredientStandardUnitCost: null,
    yieldPercent: null,
    effectiveQuantity: null,
    componentProductId: r.componentProductId,
    componentProductName: r.componentProduct?.name ?? null,
    componentProductUnitCost: componentUnitCost !== null ? componentUnitCost.toFixed(6) : null,
    quantity: r.quantity.toFixed(3),
    unit: r.unit,
    notes: r.notes,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    directLineCost: directCost !== null ? directCost.toFixed(4) : null,
    adjustedLineCost: directCost !== null ? directCost.toFixed(4) : null,
    lineCost: directCost !== null ? directCost.toFixed(4) : null,
  };
}

const recipeItemInclude = {
  ingredient: {
    select: {
      id: true,
      name: true,
      baseUnit: true,
      purchasePrice: true,
      purchaseQuantity: true,
      purchaseUnit: true,
      yieldPercent: true,
    },
  },
  componentProduct: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.RecipeItemInclude;

// ─── Recipe CRUD ──────────────────────────────────────────────────────────────

function toRecipeRow(r: {
  id: string;
  productId: string;
  name: string;
  isActive: boolean;
  outputQuantity: Prisma.Decimal;
  outputUnit: UnitType;
  createdAt: Date;
  updatedAt: Date;
}): RecipeRow {
  return {
    id: r.id,
    productId: r.productId,
    name: r.name,
    isActive: r.isActive,
    outputQuantity: r.outputQuantity.toFixed(3),
    outputUnit: r.outputUnit,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/**
 * Returns the active recipe for a product, or null if none exists.
 */
export async function getRecipeByProductId(productId: string): Promise<RecipeRow | null> {
  const row = await prisma.recipe.findFirst({
    where: { productId, isActive: true },
  });
  if (!row) return null;
  return toRecipeRow(row);
}

/**
 * Creates a new recipe for a product.
 * Business rule: a product may only have one active recipe.
 * If one already exists, throws an error.
 */
export async function createRecipeForProduct(
  productId: string,
  name: string
): Promise<RecipeRow> {
  // Validate product exists
  const product = await prisma.menuProduct.findUnique({ where: { id: productId } });
  if (!product) throw new Error("PRODUCT_NOT_FOUND");

  // Enforce one active recipe per product
  const existing = await prisma.recipe.findFirst({ where: { productId, isActive: true } });
  if (existing) throw new Error("ACTIVE_RECIPE_EXISTS");

  const row = await prisma.recipe.create({
    data: { productId, name, isActive: true },
  });
  return toRecipeRow(row);
}

/**
 * Gets or creates an active recipe for a product.
 * If an active recipe exists, updates the name and output fields if provided.
 */
export async function upsertRecipeForProduct(
  productId: string,
  name: string,
  outputQuantity?: number,
  outputUnit?: UnitType
): Promise<RecipeRow> {
  // Validate product exists
  const product = await prisma.menuProduct.findUnique({ where: { id: productId } });
  if (!product) throw new Error("PRODUCT_NOT_FOUND");

  // Validate output quantity
  if (outputQuantity !== undefined && outputQuantity <= 0) throw new Error("INVALID_OUTPUT_QUANTITY");

  const existing = await prisma.recipe.findFirst({ where: { productId, isActive: true } });

  const updateData = {
    name,
    ...(outputQuantity !== undefined ? { outputQuantity: String(outputQuantity) } : {}),
    ...(outputUnit !== undefined ? { outputUnit } : {}),
  };

  if (existing) {
    const row = await prisma.recipe.update({
      where: { id: existing.id },
      data: updateData,
    });
    return toRecipeRow(row);
  }

  const row = await prisma.recipe.create({
    data: {
      productId,
      name,
      isActive: true,
      outputQuantity: outputQuantity !== undefined ? String(outputQuantity) : "1",
      outputUnit: outputUnit ?? UnitType.EA,
    },
  });
  return toRecipeRow(row);
}

// ─── Recipe Item CRUD ─────────────────────────────────────────────────────────

export async function listRecipeItems(recipeId: string): Promise<RecipeItemRow[]> {
  const rows = await prisma.recipeItem.findMany({
    where: { recipeId },
    include: recipeItemInclude,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  // Resolve component product unit costs in parallel
  const componentProductIds = rows
    .filter((r) => r.sourceType === RecipeItemSourceType.PRODUCT && r.componentProductId)
    .map((r) => r.componentProductId as string);

  const uniqueProductIds = [...new Set(componentProductIds)];
  const unitCostMap = new Map<string, number | null>();

  await Promise.all(
    uniqueProductIds.map(async (productId) => {
      const cost = await getComponentProductUnitCost(productId);
      unitCostMap.set(productId, cost);
    })
  );

  return rows.map((r) => {
    const componentUnitCost =
      r.sourceType === RecipeItemSourceType.PRODUCT && r.componentProductId
        ? (unitCostMap.get(r.componentProductId) ?? null)
        : null;
    return toRecipeItemRow(r, componentUnitCost);
  });
}

export type AddRecipeItemInput = {
  recipeId: string;
  sourceType?: RecipeItemSourceType;
  ingredientId?: string | null;
  componentProductId?: string | null;
  quantity: number;
  unit: UnitType;
  notes?: string | null;
  sortOrder?: number;
};

/**
 * Adds an ingredient or product component to a recipe.
 * Business rules:
 * - recipe must exist
 * - sourceType determines which source fields are required
 * - for INGREDIENT: ingredientId required, must exist and be active, unit must match baseUnit, no duplicate
 * - for PRODUCT: componentProductId required, must exist and have canBeUsedAsRecipeComponent=true, no self-reference
 * - quantity must be > 0
 */
export async function addRecipeItem(input: AddRecipeItemInput): Promise<RecipeItemRow> {
  const sourceType = input.sourceType ?? RecipeItemSourceType.INGREDIENT;

  // Validate recipe exists
  const recipe = await prisma.recipe.findUnique({ where: { id: input.recipeId } });
  if (!recipe) throw new Error("RECIPE_NOT_FOUND");

  // Validate quantity > 0
  if (input.quantity <= 0) throw new Error("INVALID_QUANTITY");

  if (sourceType === RecipeItemSourceType.INGREDIENT) {
    if (!input.ingredientId) throw new Error("INGREDIENT_REQUIRED");
    if (input.componentProductId) throw new Error("COMPONENT_PRODUCT_MUST_BE_NULL");

    // Validate ingredient exists and is active
    const ingredient = await prisma.ingredient.findUnique({ where: { id: input.ingredientId } });
    if (!ingredient) throw new Error("INGREDIENT_NOT_FOUND");
    if (!ingredient.isActive) throw new Error("INGREDIENT_INACTIVE");

    // Validate unit matches ingredient.baseUnit
    if (input.unit !== ingredient.baseUnit) throw new Error("UNIT_MISMATCH");

    // Check for duplicate ingredient in this recipe
    const duplicate = await prisma.recipeItem.findFirst({
      where: {
        recipeId: input.recipeId,
        sourceType: RecipeItemSourceType.INGREDIENT,
        ingredientId: input.ingredientId,
      },
    });
    if (duplicate) throw new Error("DUPLICATE_INGREDIENT");

    const row = await prisma.recipeItem.create({
      data: {
        recipeId: input.recipeId,
        sourceType: RecipeItemSourceType.INGREDIENT,
        ingredientId: input.ingredientId,
        componentProductId: null,
        quantity: String(input.quantity),
        unit: input.unit,
        notes: input.notes ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
      include: recipeItemInclude,
    });
    return toRecipeItemRow(row, null);
  }

  // sourceType === PRODUCT
  if (!input.componentProductId) throw new Error("COMPONENT_PRODUCT_REQUIRED");
  if (input.ingredientId) throw new Error("INGREDIENT_ID_MUST_BE_NULL");

  // Self-reference check: the component product cannot be the same as the recipe's product
  if (input.componentProductId === recipe.productId) {
    throw new Error("SELF_REFERENCE");
  }

  // Validate component product exists and is flagged
  const componentProduct = await prisma.menuProduct.findUnique({
    where: { id: input.componentProductId },
  });
  if (!componentProduct) throw new Error("COMPONENT_PRODUCT_NOT_FOUND");
  if (!componentProduct.canBeUsedAsRecipeComponent) throw new Error("COMPONENT_NOT_ALLOWED");

  // TODO: Deep cycle detection (A->B->A) — guard point for Phase 9+.
  // Currently we block direct self-reference only. For full cycle detection,
  // implement a graph traversal across all component product recipes.

  // Check for duplicate component product in this recipe
  const duplicate = await prisma.recipeItem.findFirst({
    where: {
      recipeId: input.recipeId,
      sourceType: RecipeItemSourceType.PRODUCT,
      componentProductId: input.componentProductId,
    },
  });
  if (duplicate) throw new Error("DUPLICATE_COMPONENT_PRODUCT");

  const row = await prisma.recipeItem.create({
    data: {
      recipeId: input.recipeId,
      sourceType: RecipeItemSourceType.PRODUCT,
      ingredientId: null,
      componentProductId: input.componentProductId,
      quantity: String(input.quantity),
      unit: input.unit,
      notes: input.notes ?? null,
      sortOrder: input.sortOrder ?? 0,
    },
    include: recipeItemInclude,
  });

  const componentUnitCost = await getComponentProductUnitCost(input.componentProductId);
  return toRecipeItemRow(row, componentUnitCost);
}

export type UpdateRecipeItemInput = {
  quantity?: number;
  notes?: string | null;
  sortOrder?: number;
};

export async function updateRecipeItem(
  itemId: string,
  input: UpdateRecipeItemInput
): Promise<RecipeItemRow> {
  if (input.quantity !== undefined && input.quantity <= 0) throw new Error("INVALID_QUANTITY");

  const row = await prisma.recipeItem.update({
    where: { id: itemId },
    data: {
      ...(input.quantity !== undefined ? { quantity: String(input.quantity) } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
    include: recipeItemInclude,
  });

  let componentUnitCost: number | null = null;
  if (row.sourceType === RecipeItemSourceType.PRODUCT && row.componentProductId) {
    componentUnitCost = await getComponentProductUnitCost(row.componentProductId);
  }

  return toRecipeItemRow(row, componentUnitCost);
}

export async function removeRecipeItem(itemId: string): Promise<void> {
  await prisma.recipeItem.delete({ where: { id: itemId } });
}

/**
 * Updates sort order for multiple recipe items at once.
 * Takes an ordered array of item IDs and assigns sortOrder 0, 1, 2, ...
 */
export async function reorderRecipeItems(orderedItemIds: string[]): Promise<void> {
  await prisma.$transaction(
    orderedItemIds.map((id, index) =>
      prisma.recipeItem.update({ where: { id }, data: { sortOrder: index } })
    )
  );
}

// ─── Cost Summary ─────────────────────────────────────────────────────────────

/**
 * Returns the full cost summary for the active recipe of a product.
 * Returns null if the product has no active recipe.
 */
export async function getRecipeCostSummary(productId: string): Promise<RecipeCostSummary | null> {
  const recipe = await prisma.recipe.findFirst({
    where: { productId, isActive: true },
  });
  if (!recipe) return null;

  const items = await listRecipeItems(recipe.id);
  const isFullyCosted = items.every((item) => item.directLineCost !== null);

  const directLineCosts = items.map((item) =>
    item.directLineCost !== null ? parseFloat(item.directLineCost) : null
  );
  const adjustedLineCosts = items.map((item) =>
    item.adjustedLineCost !== null ? parseFloat(item.adjustedLineCost) : null
  );

  const batchDirectTotalNum = calculateRecipeTotalCost(directLineCosts);
  const batchAdjustedTotalNum = calculateRecipeTotalCost(adjustedLineCosts);
  const outputQty = parseFloat(recipe.outputQuantity.toString());

  const batchDirectTotalCost = batchDirectTotalNum !== null ? batchDirectTotalNum.toFixed(4) : null;
  const batchAdjustedTotalCost = batchAdjustedTotalNum !== null ? batchAdjustedTotalNum.toFixed(4) : null;

  const directCostPerOutputUnitNum = calculateCostPerOutputUnit(batchDirectTotalNum, outputQty);
  const adjustedCostPerOutputUnitNum = calculateCostPerOutputUnit(batchAdjustedTotalNum, outputQty);

  const directCostPerOutputUnit =
    directCostPerOutputUnitNum !== null ? directCostPerOutputUnitNum.toFixed(6) : null;
  const adjustedCostPerOutputUnit =
    adjustedCostPerOutputUnitNum !== null ? adjustedCostPerOutputUnitNum.toFixed(6) : null;

  return {
    recipe: toRecipeRow(recipe),
    items,
    batchDirectTotalCost,
    batchAdjustedTotalCost,
    directCostPerOutputUnit,
    adjustedCostPerOutputUnit,
    outputQuantity: outputQty.toFixed(3),
    outputUnit: recipe.outputUnit,
    isFullyCosted,
    // Backward-compat aliases
    directTotalCost: batchDirectTotalCost,
    adjustedTotalCost: batchAdjustedTotalCost,
    totalCost: batchDirectTotalCost,
  };
}

// ─── Product List Summary ─────────────────────────────────────────────────────

export type ProductRecipeSummary = {
  productId: string;
  hasActiveRecipe: boolean;
  recipeName: string | null;
  ingredientCount: number;
  totalCost: string | null;
  directTotalCost: string | null;
  adjustedTotalCost: string | null;
  outputQuantity: string | null;
  outputUnit: UnitType | null;
  adjustedCostPerOutputUnit: string | null;
};

/**
 * Returns recipe summary info for a list of product IDs in a single batched query.
 */
export async function getProductRecipeSummaries(
  productIds: string[]
): Promise<Map<string, ProductRecipeSummary>> {
  if (productIds.length === 0) return new Map();

  const recipes = await prisma.recipe.findMany({
    where: { productId: { in: productIds }, isActive: true },
    include: {
      items: {
        include: {
          ingredient: {
            select: {
              id: true,
              name: true,
              baseUnit: true,
              purchasePrice: true,
              purchaseQuantity: true,
              purchaseUnit: true,
              yieldPercent: true,
            },
          },
          componentProduct: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  // Collect all component product IDs across all recipes
  const allComponentProductIds = new Set<string>();
  for (const recipe of recipes) {
    for (const item of recipe.items) {
      if (item.sourceType === RecipeItemSourceType.PRODUCT && item.componentProductId) {
        allComponentProductIds.add(item.componentProductId);
      }
    }
  }

  // Resolve component unit costs
  const componentUnitCostMap = new Map<string, number | null>();
  await Promise.all(
    [...allComponentProductIds].map(async (productId) => {
      const cost = await getComponentProductUnitCost(productId);
      componentUnitCostMap.set(productId, cost);
    })
  );

  const summaryMap = new Map<string, ProductRecipeSummary>();

  for (const recipe of recipes) {
    const items = recipe.items.map((r) => {
      const componentUnitCost =
        r.sourceType === RecipeItemSourceType.PRODUCT && r.componentProductId
          ? (componentUnitCostMap.get(r.componentProductId) ?? null)
          : null;
      return toRecipeItemRow(r, componentUnitCost);
    });

    const allCosted = items.every((i) => i.directLineCost !== null);
    const outputQty = parseFloat(recipe.outputQuantity.toString());

    let directTotalCost: string | null = null;
    let adjustedTotalCost: string | null = null;
    let adjustedCostPerOutputUnit: string | null = null;

    if (allCosted && items.length > 0) {
      const directSum = items.reduce((acc, i) => acc + parseFloat(i.directLineCost!), 0);
      const adjustedSum = items.reduce((acc, i) => acc + parseFloat(i.adjustedLineCost!), 0);
      directTotalCost = directSum.toFixed(4);
      adjustedTotalCost = adjustedSum.toFixed(4);
      const perUnit = calculateCostPerOutputUnit(adjustedSum, outputQty);
      adjustedCostPerOutputUnit = perUnit !== null ? perUnit.toFixed(6) : null;
    }

    summaryMap.set(recipe.productId, {
      productId: recipe.productId,
      hasActiveRecipe: true,
      recipeName: recipe.name,
      ingredientCount: items.length,
      totalCost: directTotalCost,
      directTotalCost,
      adjustedTotalCost,
      outputQuantity: outputQty.toFixed(3),
      outputUnit: recipe.outputUnit,
      adjustedCostPerOutputUnit,
    });
  }

  // Fill in products without a recipe
  for (const productId of productIds) {
    if (!summaryMap.has(productId)) {
      summaryMap.set(productId, {
        productId,
        hasActiveRecipe: false,
        recipeName: null,
        ingredientCount: 0,
        totalCost: null,
        directTotalCost: null,
        adjustedTotalCost: null,
        outputQuantity: null,
        outputUnit: null,
        adjustedCostPerOutputUnit: null,
      });
    }
  }

  return summaryMap;
}
