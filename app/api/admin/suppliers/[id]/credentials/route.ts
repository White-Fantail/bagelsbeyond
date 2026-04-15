import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import {
  getCredentialStatus,
  upsertCredentials,
  deleteCredentials,
  testCredentials,
} from "@/lib/services/supplierSyncService";
import { listAdapters, getAdapter } from "@/lib/suppliers/registry";
import { supplierCredentialsSchema } from "@/lib/validations";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id: supplierId } = await params;

  try {
    const [status, adapters] = await Promise.all([
      getCredentialStatus(supplierId),
      Promise.resolve(listAdapters()),
    ]);
    return NextResponse.json({ status, adapters });
  } catch {
    return NextResponse.json(
      { message: "Failed to fetch credential status" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id: supplierId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = supplierCredentialsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const adapter = getAdapter(parsed.data.adapterKey);
  if (!adapter) {
    return NextResponse.json(
      { message: `Unknown adapter "${parsed.data.adapterKey}"` },
      { status: 400 }
    );
  }

  try {
    const status = await upsertCredentials(
      supplierId,
      parsed.data.adapterKey,
      parsed.data.credentials,
      parsed.data.notes ?? null
    );
    return NextResponse.json({ status });
  } catch {
    return NextResponse.json(
      { message: "Failed to save credentials" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id: supplierId } = await params;

  try {
    await deleteCredentials(supplierId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { message: "Failed to delete credentials" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id: supplierId } = await params;

  // Action: test connection
  const url = new URL(req.url);
  if (url.searchParams.get("action") === "test") {
    try {
      const result = await testCredentials(supplierId);
      return NextResponse.json(result);
    } catch {
      return NextResponse.json(
        { message: "Failed to test connection" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ message: "Unknown action" }, { status: 400 });
}
