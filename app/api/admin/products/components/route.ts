import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { listComponentProducts } from "@/lib/services/menuProductService";

/**
 * GET /api/admin/products/components
 * Returns all active products with canBeUsedAsRecipeComponent = true.
 */
export async function GET(_req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const products = await listComponentProducts();
    return NextResponse.json({ products });
  } catch {
    return NextResponse.json({ message: "Failed to fetch component products" }, { status: 500 });
  }
}
