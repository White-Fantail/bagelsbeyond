import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { addRecipeItem } from "@/lib/services/recipeService";
import { recipeItemSchema } from "@/lib/validations";
import { UnitType } from "@/app/generated/prisma/enums";
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
      ingredientId: parsed.data.ingredientId,
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
      INVALID_QUANTITY: { message: "Quantity must be greater than 0", status: 422 },
      UNIT_MISMATCH: { message: "Unit must match the ingredient base unit", status: 422 },
      DUPLICATE_INGREDIENT: { message: "This ingredient is already in the recipe", status: 409 },
    };
    const mapped = errorMap[msg];
    if (mapped) {
      return NextResponse.json({ message: mapped.message }, { status: mapped.status });
    }
    return NextResponse.json({ message: "Failed to add recipe item" }, { status: 500 });
  }
}
