import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { getItemModifierGroups } from "@/lib/catalog/queries/items";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await apiRequireAdmin();
  if (isNextResponse(auth)) return auth;

  const { id } = await params;
  const groups = await getItemModifierGroups(id);
  return NextResponse.json(groups);
}
