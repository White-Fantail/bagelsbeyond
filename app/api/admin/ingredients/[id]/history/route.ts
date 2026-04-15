import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { buildIngredientHistoryViewModel } from "@/lib/costing/ingredient-price-history";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;

  try {
    const history = await buildIngredientHistoryViewModel(id);
    return NextResponse.json({ history });
  } catch {
    return NextResponse.json({ message: "Failed to fetch price history" }, { status: 500 });
  }
}
