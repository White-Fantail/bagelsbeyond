import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { updateRecipeItem, removeRecipeItem } from "@/lib/services/recipeService";
import { updateRecipeItemSchema } from "@/lib/validations";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string; itemId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { itemId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = updateRecipeItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const item = await updateRecipeItem(itemId, parsed.data);
    return NextResponse.json({ item });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "INVALID_QUANTITY") {
      return NextResponse.json({ message: "Quantity must be greater than 0" }, { status: 422 });
    }
    if (msg.includes("Record to update not found")) {
      return NextResponse.json({ message: "Recipe item not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Failed to update recipe item" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string; itemId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { itemId } = await params;

  try {
    await removeRecipeItem(itemId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Record to delete does not exist")) {
      return NextResponse.json({ message: "Recipe item not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Failed to remove recipe item" }, { status: 500 });
  }
}
