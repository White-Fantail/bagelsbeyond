import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { getSupplierById, updateSupplier, archiveSupplier } from "@/lib/services/supplierService";
import { supplierSchema } from "@/lib/validations";
import { SupplierIntegrationType } from "@/app/generated/prisma/enums";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;
  const supplier = await getSupplierById(id);
  if (!supplier) {
    return NextResponse.json({ message: "Supplier not found" }, { status: 404 });
  }
  return NextResponse.json({ supplier });
}

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

  const parsed = supplierSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    const supplier = await updateSupplier(id, {
      name: data.name,
      slug: data.slug,
      integrationType: data.integrationType as SupplierIntegrationType | undefined,
      websiteUrl: data.websiteUrl,
      notes: data.notes,
      isActive: data.isActive,
    });
    return NextResponse.json({ supplier });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update supplier";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;

  try {
    const supplier = await archiveSupplier(id);
    return NextResponse.json({ supplier });
  } catch {
    return NextResponse.json({ message: "Failed to archive supplier" }, { status: 500 });
  }
}
