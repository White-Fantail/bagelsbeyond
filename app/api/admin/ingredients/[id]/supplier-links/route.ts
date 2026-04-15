import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import {
  listIngredientSupplierLinks,
  createIngredientSupplierLink,
} from "@/lib/services/supplierService";
import { ingredientSupplierLinkSchema } from "@/lib/validations";
import { UnitType, SupplierSyncMode } from "@/app/generated/prisma/enums";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;

  try {
    const links = await listIngredientSupplierLinks(id);
    return NextResponse.json({ links });
  } catch {
    return NextResponse.json({ message: "Failed to fetch supplier links" }, { status: 500 });
  }
}

export async function POST(
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

  const parsed = ingredientSupplierLinkSchema.safeParse({ ...(body as object), ingredientId: id });
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    const link = await createIngredientSupplierLink({
      ingredientId: id,
      supplierId: data.supplierId,
      supplierProductName: data.supplierProductName,
      supplierProductCode: data.supplierProductCode ?? null,
      supplierProductUrl: data.supplierProductUrl ?? null,
      supplierPackageQuantity: data.supplierPackageQuantity ?? null,
      supplierPackageUnit: data.supplierPackageUnit as UnitType | null | undefined,
      supplierBaseUnit: data.supplierBaseUnit as UnitType | null | undefined,
      isPrimary: data.isPrimary,
      isActive: data.isActive,
      syncMode: data.syncMode as SupplierSyncMode,
      notes: data.notes ?? null,
    });
    return NextResponse.json({ link }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create supplier link";
    const status = message.includes("already exists") ? 409 : 500;
    return NextResponse.json({ message }, { status });
  }
}
