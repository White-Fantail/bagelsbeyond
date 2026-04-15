import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import {
  generateIngredientPriceCsvTemplate,
  generateSupplierLinkPriceCsvTemplate,
} from "@/lib/costing/price-import-csv";

export async function GET(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const mode = req.nextUrl.searchParams.get("mode");

  if (mode !== "INGREDIENT" && mode !== "SUPPLIER_LINK") {
    return NextResponse.json(
      { message: "mode must be INGREDIENT or SUPPLIER_LINK" },
      { status: 400 }
    );
  }

  const csv =
    mode === "INGREDIENT"
      ? generateIngredientPriceCsvTemplate()
      : generateSupplierLinkPriceCsvTemplate();

  const fileName =
    mode === "INGREDIENT" ? "ingredient-price-template.csv" : "supplier-link-price-template.csv";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
