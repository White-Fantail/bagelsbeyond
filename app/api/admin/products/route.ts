import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { listMenuProducts, createMenuProduct } from "@/lib/services/menuProductService";
import { menuProductSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const sp = req.nextUrl.searchParams;
  const search = sp.get("search") ?? undefined;
  const isActiveParam = sp.get("isActive");
  const isActive =
    isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined;
  const categoryId = sp.get("categoryId") ?? undefined;
  const loyverseLinkParam = sp.get("loyverseLink");
  const loyverseLink =
    loyverseLinkParam === "linked" || loyverseLinkParam === "internal"
      ? loyverseLinkParam
      : undefined;

  try {
    const products = await listMenuProducts({ search, isActive, categoryId, loyverseLink });
    return NextResponse.json({ products });
  } catch {
    return NextResponse.json({ message: "Failed to fetch products" }, { status: 500 });
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

  const parsed = menuProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const product = await createMenuProduct(parsed.data);
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create product";
    if (msg.includes("Unique constraint") || msg.includes("sku")) {
      return NextResponse.json({ message: "SKU already exists" }, { status: 409 });
    }
    return NextResponse.json({ message: "Failed to create product" }, { status: 500 });
  }
}
