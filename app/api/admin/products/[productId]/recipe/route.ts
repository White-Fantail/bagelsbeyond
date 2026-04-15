import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import {
  getRecipeCostSummary,
  upsertRecipeForProduct,
} from "@/lib/services/recipeService";
import { recipeSchema } from "@/lib/validations";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { productId } = await params;
  try {
    const summary = await getRecipeCostSummary(productId);
    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json({ message: "Failed to fetch recipe" }, { status: 500 });
  }
}

export async function PUT(
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

  const parsed = recipeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const recipe = await upsertRecipeForProduct(productId, parsed.data.name);
    return NextResponse.json({ recipe });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "PRODUCT_NOT_FOUND") {
      return NextResponse.json({ message: "Product not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Failed to save recipe" }, { status: 500 });
  }
}
