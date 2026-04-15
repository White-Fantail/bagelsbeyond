import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import {
  getForecastOverridesForDate,
  upsertForecastOverride,
  deleteForecastOverride,
} from "@/lib/planning/forecast-input";

// GET /api/admin/planning/forecast-overrides?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const auth = await apiRequireAdmin();
  if (isNextResponse(auth)) return auth;

  const date = req.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ message: "date query parameter required" }, { status: 400 });
  }

  try {
    const overrides = await getForecastOverridesForDate(date);
    return NextResponse.json({ overrides });
  } catch {
    return NextResponse.json({ message: "Failed to load forecast overrides" }, { status: 500 });
  }
}

// POST /api/admin/planning/forecast-overrides
// Body: { targetDate, productId, predictedSalesQty, notes? }
export async function POST(req: NextRequest) {
  const auth = await apiRequireAdmin();
  if (isNextResponse(auth)) return auth;

  let body: { targetDate?: string; productId?: string; predictedSalesQty?: number; notes?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.targetDate || !body.productId || body.predictedSalesQty === undefined) {
    return NextResponse.json({ message: "targetDate, productId, predictedSalesQty required" }, { status: 400 });
  }

  if (typeof body.predictedSalesQty !== "number" || body.predictedSalesQty < 0) {
    return NextResponse.json({ message: "predictedSalesQty must be a non-negative number" }, { status: 400 });
  }

  try {
    const row = await upsertForecastOverride({
      targetDate: body.targetDate,
      productId: body.productId,
      predictedSalesQty: body.predictedSalesQty,
      sourceType: "MANUAL",
      notes: body.notes ?? null,
    });
    return NextResponse.json({ override: row });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save override";
    if (message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json({ message: "Product not found" }, { status: 404 });
    }
    return NextResponse.json({ message }, { status: 500 });
  }
}

// DELETE /api/admin/planning/forecast-overrides?id=<overrideId>
export async function DELETE(req: NextRequest) {
  const auth = await apiRequireAdmin();
  if (isNextResponse(auth)) return auth;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "id query parameter required" }, { status: 400 });
  }

  try {
    await deleteForecastOverride(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Failed to delete override" }, { status: 500 });
  }
}
