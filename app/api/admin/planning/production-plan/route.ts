import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { buildProductionPlan } from "@/lib/planning/ingredient-needs";

// GET /api/admin/planning/production-plan?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const auth = await apiRequireAdmin();
  if (isNextResponse(auth)) return auth;

  const date = req.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ message: "date query parameter required" }, { status: 400 });
  }

  try {
    const plan = await buildProductionPlan(date);

    // Serialize Maps to plain arrays for JSON transport
    return NextResponse.json({
      targetDate: plan.targetDate,
      settings: plan.settings,
      products: plan.products,
      rawIngredients: [...plan.bomResult.rawIngredients.values()],
      componentRequirements: [...plan.bomResult.componentRequirements.values()],
      profitForecast: plan.profitForecast,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to build production plan";
    return NextResponse.json({ message }, { status: 500 });
  }
}
