import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { applyPriceImport } from "@/lib/services/priceImportService";
import type { PriceImportPreviewResult } from "@/lib/services/priceImportService";

export async function POST(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const { preview, includeWarnings } = body as { preview?: PriceImportPreviewResult; includeWarnings?: boolean };

  if (!preview || !preview.rows || !preview.mode) {
    return NextResponse.json({ message: "preview is required" }, { status: 400 });
  }

  try {
    const result = await applyPriceImport(preview, {
      includeWarnings: includeWarnings ?? true,
      createdByUserId: authResult.userId,
    });
    return NextResponse.json({ result });
  } catch {
    return NextResponse.json({ message: "Failed to apply price import" }, { status: 500 });
  }
}
