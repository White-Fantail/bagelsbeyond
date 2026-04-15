import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { addRecipeItem } from "@/lib/services/recipeService";
import { recipeItemSchema } from "@/lib/validations";
import { UnitType, RecipeItemSourceType } from "@/app/generated/prisma/enums";
import { getRecipeByProductId } from "@/lib/services/recipeService";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { productId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = recipeItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Resolve the active recipe for this product
  const recipe = await getRecipeByProductId(productId);
  if (!recipe) {
    return NextResponse.json(
      { message: "No active recipe found for this product. Create a recipe first." },
      { status: 404 }
    );
  }

  try {
    const item = await addRecipeItem({
      recipeId: recipe.id,
      sourceType: parsed.data.sourceType as RecipeItemSourceType,
      ingredientId: parsed.data.ingredientId ?? null,
      componentProductId: parsed.data.componentProductId ?? null,
      quantity: parsed.data.quantity,
      unit: parsed.data.unit as UnitType,
      notes: parsed.data.notes,
      sortOrder: parsed.data.sortOrder,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    const errorMap: Record<string, { message: string; status: number }> = {
      RECIPE_NOT_FOUND: { message: "Recipe not found", status: 404 },
      INGREDIENT_NOT_FOUND: { message: "Ingredient not found", status: 404 },
      INGREDIENT_INACTIVE: { message: "Ingredient is inactive and cannot be added to recipes", status: 422 },
      INGREDIENT_REQUIRED: { message: "Ingredient is required for INGREDIENT source type", status: 422 },
      COMPONENT_PRODUCT_MUST_BE_NULL: { message: "componentProductId must be null for INGREDIENT source type", status: 422 },
      INVALID_QUANTITY: { message: "Quantity must be greater than 0", status: 422 },
      UNIT_MISMATCH: { message: "Unit must match the ingredient base unit", status: 422 },
      DUPLICATE_INGREDIENT: { message: "This ingredient is already in the recipe", status: 409 },
      COMPONENT_PRODUCT_REQUIRED: { message: "Component product is required for PRODUCT source type", status: 422 },
      INGREDIENT_ID_MUST_BE_NULL: { message: "ingredientId must be null for PRODUCT source type", status: 422 },
      SELF_REFERENCE: { message: "A product cannot include itself as a component in its own recipe", status: 422 },
      COMPONENT_PRODUCT_NOT_FOUND: { message: "Component product not found", status: 404 },
      COMPONENT_NOT_ALLOWED: { message: "This product is not allowed as a recipe component. Enable 'Can be used as recipe component' on the product first.", status: 422 },
      DUPLICATE_COMPONENT_PRODUCT: { message: "This component product is already in the recipe", status: 409 },
    };
    const mapped = errorMap[msg];
    if (mapped) {
      return NextResponse.json({ message: mapped.message }, { status: mapped.status });
    }
    return NextResponse.json({ message: "Failed to add recipe item" }, { status: 500 });
  }
}
