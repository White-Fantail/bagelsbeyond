import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import {
  getIngredientSupplierLinkById,
  updateIngredientSupplierLink,
  archiveIngredientSupplierLink,
} from "@/lib/services/supplierService";
import { ingredientSupplierLinkSchema } from "@/lib/validations";
import { UnitType, SupplierSyncMode } from "@/app/generated/prisma/enums";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { linkId } = await params;
  const link = await getIngredientSupplierLinkById(linkId);
  if (!link) {
    return NextResponse.json({ message: "Supplier link not found" }, { status: 404 });
  }
  return NextResponse.json({ link });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { linkId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = ingredientSupplierLinkSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    const link = await updateIngredientSupplierLink(linkId, {
      supplierProductName: data.supplierProductName,
      supplierProductCode: data.supplierProductCode,
      supplierProductUrl: data.supplierProductUrl,
      supplierPackageQuantity: data.supplierPackageQuantity ?? null,
      supplierPackageUnit: data.supplierPackageUnit as UnitType | null | undefined,
      supplierBaseUnit: data.supplierBaseUnit as UnitType | null | undefined,
      isPrimary: data.isPrimary,
      isActive: data.isActive,
      syncMode: data.syncMode as SupplierSyncMode | undefined,
      notes: data.notes,
    });
    return NextResponse.json({ link });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update supplier link";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { linkId } = await params;

  try {
    const link = await archiveIngredientSupplierLink(linkId);
    return NextResponse.json({ link });
  } catch {
    return NextResponse.json({ message: "Failed to archive supplier link" }, { status: 500 });
  }
}
