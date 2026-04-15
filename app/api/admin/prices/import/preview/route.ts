import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { previewIngredientModeCsv, previewSupplierLinkModeCsv } from "@/lib/services/priceImportService";

export async function POST(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const { mode, csvText, fileName } = body as { mode?: string; csvText?: string; fileName?: string };

  if (!csvText || typeof csvText !== "string") {
    return NextResponse.json({ message: "csvText is required" }, { status: 400 });
  }
  if (!mode || (mode !== "INGREDIENT" && mode !== "SUPPLIER_LINK")) {
    return NextResponse.json({ message: "mode must be INGREDIENT or SUPPLIER_LINK" }, { status: 400 });
  }

  try {
    const result =
      mode === "INGREDIENT"
        ? await previewIngredientModeCsv(csvText, fileName)
        : await previewSupplierLinkModeCsv(csvText, fileName);
    return NextResponse.json({ preview: result });
  } catch {
    return NextResponse.json({ message: "Failed to parse CSV" }, { status: 500 });
  }
}
