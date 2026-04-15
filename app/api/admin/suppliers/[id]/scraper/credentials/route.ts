import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import {
  getScraperCredentialStatus,
  upsertScraperCredentials,
  deleteScraperCredentials,
  testScraperCredentials,
  listScraperAdapters,
} from "@/lib/services/scraperSyncService";
import { getScraperAdapter } from "@/lib/suppliers/scrapers/registry";
import { scraperCredentialsSchema } from "@/lib/validations";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id: supplierId } = await params;

  try {
    const [status, adapters] = await Promise.all([
      getScraperCredentialStatus(supplierId),
      Promise.resolve(listScraperAdapters()),
    ]);
    return NextResponse.json({ status, adapters });
  } catch {
    return NextResponse.json(
      { message: "Failed to fetch scraper credential status" },
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

  const parsed = scraperCredentialsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const adapter = getScraperAdapter(parsed.data.adapterKey);
  if (!adapter) {
    return NextResponse.json(
      { message: `Unknown scraper adapter "${parsed.data.adapterKey}"` },
      { status: 400 }
    );
  }

  try {
    const status = await upsertScraperCredentials(
      supplierId,
      parsed.data.adapterKey,
      parsed.data.credentials,
      parsed.data.notes ?? null
    );
    return NextResponse.json({ status });
  } catch {
    return NextResponse.json(
      { message: "Failed to save scraper credentials" },
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
    await deleteScraperCredentials(supplierId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { message: "Failed to delete scraper credentials" },
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

  const url = new URL(req.url);
  if (url.searchParams.get("action") === "test") {
    try {
      const result = await testScraperCredentials(supplierId);
      return NextResponse.json(result);
    } catch {
      return NextResponse.json(
        { message: "Failed to test scraper login" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ message: "Unknown action" }, { status: 400 });
}
