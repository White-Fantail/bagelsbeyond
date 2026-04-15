import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { listSuppliers, createSupplier } from "@/lib/services/supplierService";
import { supplierSchema } from "@/lib/validations";
import { SupplierIntegrationType } from "@/app/generated/prisma/enums";

export async function GET() {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const suppliers = await listSuppliers();
    return NextResponse.json({ suppliers });
  } catch {
    return NextResponse.json({ message: "Failed to fetch suppliers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = supplierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    const supplier = await createSupplier({
      name: data.name,
      slug: data.slug,
      integrationType: data.integrationType as SupplierIntegrationType,
      websiteUrl: data.websiteUrl ?? null,
      notes: data.notes ?? null,
      isActive: data.isActive,
    });
    return NextResponse.json({ supplier }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create supplier";
    return NextResponse.json({ message }, { status: 500 });
  }
}
