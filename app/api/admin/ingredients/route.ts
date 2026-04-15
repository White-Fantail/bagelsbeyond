import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { listIngredients, createIngredient } from "@/lib/services/ingredientService";
import { ingredientSchema } from "@/lib/validations";
import { UnitType } from "@/app/generated/prisma/enums";

export async function GET(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const sp = req.nextUrl.searchParams;
  const search = sp.get("search") ?? undefined;
  const categoryId = sp.get("categoryId") ?? undefined;
  const isActiveParam = sp.get("isActive");
  const isActive =
    isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined;

  try {
    const ingredients = await listIngredients({ search, categoryId, isActive });
    return NextResponse.json({ ingredients });
  } catch {
    return NextResponse.json({ message: "Failed to fetch ingredients" }, { status: 500 });
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

  const parsed = ingredientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    const ingredient = await createIngredient({
      name: data.name,
      categoryId: data.categoryId,
      description: data.description,
      purchasePrice: data.purchasePrice,
      purchaseQuantity: data.purchaseQuantity,
      purchaseUnit: data.purchaseUnit as UnitType,
      baseUnit: data.baseUnit as UnitType,
      yieldPercent: data.yieldPercent,
      taxIncluded: data.taxIncluded,
      isActive: data.isActive,
      notes: data.notes,
      effectiveFrom: data.effectiveFrom ?? null,
      changeNote: data.changeNote ?? null,
    });
    return NextResponse.json({ ingredient }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to create ingredient" }, { status: 500 });
  }
}
