import "server-only";
import { prisma } from "@/lib/db";
import { UnitType } from "@/app/generated/prisma/enums";
import type { Prisma } from "@/app/generated/prisma/client";
import { calculateStandardUnitCost } from "@/lib/costing/ingredient-cost";
import {
  calculateRecipeItemCost,
  calculateRecipeTotalCost,
} from "@/lib/costing/recipe-cost";

export { calculateRecipeItemCost, calculateRecipeTotalCost };

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecipeRow = {
  id: string;
  productId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecipeItemRow = {
  id: string;
  recipeId: string;
  ingredientId: string;
  ingredientName: string;
  ingredientBaseUnit: UnitType;
  /** Standard unit cost in $, null if costing not available */
  ingredientStandardUnitCost: string | null;
  quantity: string;
  unit: UnitType;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  /** Derived: quantity × standardUnitCost, null if cost unavailable */
  lineCost: string | null;
};

export type RecipeCostSummary = {
  recipe: RecipeRow;
  items: RecipeItemRow[];
  /** Sum of all line costs, null if any ingredient has no standard cost */
  totalCost: string | null;
  /** true when every item has a valid standard unit cost */
  isFullyCosted: boolean;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

type RawIngredient = {
  id: string;
  name: string;
  baseUnit: UnitType;
  purchasePrice: Prisma.Decimal;
  purchaseQuantity: Prisma.Decimal;
  purchaseUnit: UnitType;
};

function getStandardUnitCost(ingredient: RawIngredient): number | null {
  const price = parseFloat(ingredient.purchasePrice.toString());
  const qty = parseFloat(ingredient.purchaseQuantity.toString());
  const result = calculateStandardUnitCost(price, qty, ingredient.purchaseUnit, ingredient.baseUnit);
  return result.isConvertible ? result.standardUnitCost : null;
}

function calculateLineCost(quantity: number, standardUnitCost: number | null): number | null {
  return calculateRecipeItemCost(quantity, standardUnitCost);
}

type RawRecipeItem = {
  id: string;
  recipeId: string;
  ingredientId: string;
  quantity: Prisma.Decimal;
  unit: UnitType;
  notes: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  ingredient: RawIngredient;
};

function toRecipeItemRow(r: RawRecipeItem): RecipeItemRow {
  const quantity = parseFloat(r.quantity.toString());
  const standardUnitCost = getStandardUnitCost(r.ingredient);
  const lineCost = calculateLineCost(quantity, standardUnitCost);

  return {
    id: r.id,
    recipeId: r.recipeId,
    ingredientId: r.ingredientId,
    ingredientName: r.ingredient.name,
    ingredientBaseUnit: r.ingredient.baseUnit,
    ingredientStandardUnitCost: standardUnitCost !== null ? standardUnitCost.toFixed(6) : null,
    quantity: r.quantity.toFixed(3),
    unit: r.unit,
    notes: r.notes,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    lineCost: lineCost !== null ? lineCost.toFixed(4) : null,
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
    },
  },
} satisfies Prisma.RecipeItemInclude;

// ─── Recipe CRUD ──────────────────────────────────────────────────────────────

function toRecipeRow(r: {
  id: string;
  productId: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): RecipeRow {
  return {
    id: r.id,
    productId: r.productId,
    name: r.name,
    isActive: r.isActive,
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
 * If an active recipe exists, updates the name if provided.
 */
export async function upsertRecipeForProduct(
  productId: string,
  name: string
): Promise<RecipeRow> {
  // Validate product exists
  const product = await prisma.menuProduct.findUnique({ where: { id: productId } });
  if (!product) throw new Error("PRODUCT_NOT_FOUND");

  const existing = await prisma.recipe.findFirst({ where: { productId, isActive: true } });

  if (existing) {
    const row = await prisma.recipe.update({
      where: { id: existing.id },
      data: { name },
    });
    return toRecipeRow(row);
  }

  const row = await prisma.recipe.create({
    data: { productId, name, isActive: true },
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
  return rows.map(toRecipeItemRow);
}

export type AddRecipeItemInput = {
  recipeId: string;
  ingredientId: string;
  quantity: number;
  unit: UnitType;
  notes?: string | null;
  sortOrder?: number;
};

/**
 * Adds an ingredient to a recipe.
 * Business rules:
 * - recipe must exist
 * - ingredient must exist and be active
 * - quantity must be > 0
 * - unit must match ingredient.baseUnit
 * - no duplicate ingredient in same recipe
 */
export async function addRecipeItem(input: AddRecipeItemInput): Promise<RecipeItemRow> {
  // Validate recipe exists
  const recipe = await prisma.recipe.findUnique({ where: { id: input.recipeId } });
  if (!recipe) throw new Error("RECIPE_NOT_FOUND");

  // Validate ingredient exists and is active
  const ingredient = await prisma.ingredient.findUnique({ where: { id: input.ingredientId } });
  if (!ingredient) throw new Error("INGREDIENT_NOT_FOUND");
  if (!ingredient.isActive) throw new Error("INGREDIENT_INACTIVE");

  // Validate quantity > 0
  if (input.quantity <= 0) throw new Error("INVALID_QUANTITY");

  // Validate unit matches ingredient.baseUnit
  if (input.unit !== ingredient.baseUnit) throw new Error("UNIT_MISMATCH");

  // Check for duplicate
  const duplicate = await prisma.recipeItem.findUnique({
    where: { recipeId_ingredientId: { recipeId: input.recipeId, ingredientId: input.ingredientId } },
  });
  if (duplicate) throw new Error("DUPLICATE_INGREDIENT");

  const row = await prisma.recipeItem.create({
    data: {
      recipeId: input.recipeId,
      ingredientId: input.ingredientId,
      quantity: String(input.quantity),
      unit: input.unit,
      notes: input.notes ?? null,
      sortOrder: input.sortOrder ?? 0,
    },
    include: recipeItemInclude,
  });
  return toRecipeItemRow(row);
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
  return toRecipeItemRow(row);
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
  const isFullyCosted = items.every((item) => item.lineCost !== null);

  const lineCosts = items.map((item) =>
    item.lineCost !== null ? parseFloat(item.lineCost) : null
  );
  const totalCostNum = calculateRecipeTotalCost(lineCosts);
  const totalCost = totalCostNum !== null ? totalCostNum.toFixed(4) : null;

  return {
    recipe: toRecipeRow(recipe),
    items,
    totalCost,
    isFullyCosted,
  };
}

/**
 * Calculates the line cost for a single recipe item given quantity and standard unit cost.
 * Pure calculation helper — does not hit the database.
 */
export function calculateRecipeItemCost(
  quantity: number,
  standardUnitCost: number | null
): number | null {
  return calculateLineCost(quantity, standardUnitCost);
}

/**
 * Calculates the total cost from an array of line costs.
 * Returns null if any line cost is null.
 */
export function calculateRecipeTotalCost(lineCosts: (number | null)[]): number | null {
  if (lineCosts.some((c) => c === null)) return null;
  return (lineCosts as number[]).reduce((acc, c) => acc + c, 0);
}

// ─── Product List Summary ─────────────────────────────────────────────────────

export type ProductRecipeSummary = {
  productId: string;
  hasActiveRecipe: boolean;
  recipeName: string | null;
  ingredientCount: number;
  totalCost: string | null;
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
            },
          },
        },
      },
    },
  });

  const summaryMap = new Map<string, ProductRecipeSummary>();

  for (const recipe of recipes) {
    const items = recipe.items.map(toRecipeItemRow);
    const allCosted = items.every((i) => i.lineCost !== null);
    let totalCost: string | null = null;
    if (allCosted && items.length > 0) {
      const sum = items.reduce((acc, i) => acc + parseFloat(i.lineCost!), 0);
      totalCost = sum.toFixed(4);
    }

    summaryMap.set(recipe.productId, {
      productId: recipe.productId,
      hasActiveRecipe: true,
      recipeName: recipe.name,
      ingredientCount: items.length,
      totalCost,
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
      });
    }
  }

  return summaryMap;
}
