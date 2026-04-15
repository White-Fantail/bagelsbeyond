import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { setPrimaryIngredientSupplierLink } from "@/lib/services/supplierService";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { linkId } = await params;

  try {
    const link = await setPrimaryIngredientSupplierLink(linkId);
    return NextResponse.json({ link });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to set primary supplier link";
    return NextResponse.json({ message }, { status: 500 });
  }
}
