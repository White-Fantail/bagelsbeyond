import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { updateProductCategory } from "@/lib/services/menuProductService";
import { productCategorySchema } from "@/lib/validations";

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

  const parsed = productCategorySchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const category = await updateProductCategory(id, parsed.data);
    revalidatePath("/product-categories");
    revalidatePath("/freshness");
    return NextResponse.json({ category });
  } catch (err) {
    const msg =
      err instanceof Error && err.message.includes("Unique constraint")
        ? "A category with this name or slug already exists"
        : "Failed to update category";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
