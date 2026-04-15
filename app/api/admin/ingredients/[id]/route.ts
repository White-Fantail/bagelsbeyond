import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import {
  getIngredientById,
  updateIngredient,
  archiveIngredient,
} from "@/lib/services/ingredientService";
import { ingredientSchema, ingredientUpdateSchema } from "@/lib/validations";
import { UnitType } from "@/app/generated/prisma/enums";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;
  const ingredient = await getIngredientById(id);
  if (!ingredient) {
    return NextResponse.json({ message: "Ingredient not found" }, { status: 404 });
  }
  return NextResponse.json({ ingredient });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = ingredientUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    const ingredient = await updateIngredient(id, {
      ...data,
      purchaseUnit: data.purchaseUnit as UnitType | undefined,
      baseUnit: data.baseUnit as UnitType | undefined,
      effectiveFrom: data.effectiveFrom ?? null,
      changeNote: data.changeNote ?? null,
    });
    return NextResponse.json({ ingredient });
  } catch {
    return NextResponse.json({ message: "Failed to update ingredient" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;

  try {
    const ingredient = await archiveIngredient(id);
    return NextResponse.json({ ingredient });
  } catch {
    return NextResponse.json({ message: "Failed to archive ingredient" }, { status: 500 });
  }
}
