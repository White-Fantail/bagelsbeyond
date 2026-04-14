import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import {
  listIngredientCategories,
  createIngredientCategory,
} from "@/lib/services/ingredientService";
import { ingredientCategorySchema } from "@/lib/validations";

export async function GET() {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const categories = await listIngredientCategories();
    return NextResponse.json({ categories });
  } catch {
    return NextResponse.json({ message: "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = ingredientCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const category = await createIngredientCategory(parsed.data);
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error && err.message.includes("Unique constraint")
      ? "A category with this name or slug already exists"
      : "Failed to create category";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
