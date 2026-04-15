import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { searchScraperProducts } from "@/lib/services/scraperSyncService";
import { scraperSearchSchema } from "@/lib/validations";

export async function POST(
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
    body = {};
  }

  const parsed = scraperSearchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const products = await searchScraperProducts(
      supplierId,
      parsed.data.query,
      parsed.data.limit
    );
    return NextResponse.json({ products });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to search supplier products";
    return NextResponse.json({ message }, { status: 500 });
  }
}
