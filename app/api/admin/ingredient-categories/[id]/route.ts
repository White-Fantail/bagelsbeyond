import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { updateIngredientCategory } from "@/lib/services/ingredientService";
import { ingredientCategorySchema } from "@/lib/validations";

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

  const parsed = ingredientCategorySchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const category = await updateIngredientCategory(id, parsed.data);
    return NextResponse.json({ category });
  } catch (err) {
    const msg =
      err instanceof Error && err.message.includes("Unique constraint")
        ? "A category with this name or slug already exists"
        : "Failed to update category";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
