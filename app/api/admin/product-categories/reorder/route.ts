import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { listProductCategories, reorderProductCategories } from "@/lib/services/menuProductService";

const reorderSchema = z.object({
  categoryIds: z.array(z.string().min(1)).min(1),
});

export async function POST(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const categories = await listProductCategories();
    const existingIds = new Set(categories.map((category) => category.id));
    const payloadIds = new Set(parsed.data.categoryIds);
    if (existingIds.size !== payloadIds.size) {
      return NextResponse.json({ message: "Invalid category order payload" }, { status: 400 });
    }

    for (const id of payloadIds) {
      if (!existingIds.has(id)) {
        return NextResponse.json({ message: "Invalid category order payload" }, { status: 400 });
      }
    }

    await reorderProductCategories(parsed.data.categoryIds);

    revalidatePath("/product-categories");
    revalidatePath("/products");
    revalidatePath("/order");
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ message: "Failed to reorder categories" }, { status: 500 });
  }
}
