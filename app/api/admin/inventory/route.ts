import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { z } from "zod";

const inventoryUpsertSchema = z.object({
  productId: z.string().min(1, "상품 ID를 입력해주세요"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식은 YYYY-MM-DD 이어야 합니다"),
  plannedQty: z.number().int().min(0, "수량은 0 이상이어야 합니다"),
  bakedQty: z.number().int().min(0, "수량은 0 이상이어야 합니다"),
  reservedQty: z.number().int().min(0, "수량은 0 이상이어야 합니다"),
  soldQty: z.number().int().min(0, "수량은 0 이상이어야 합니다"),
  isSoldOut: z.boolean(),
  note: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const dateParam = req.nextUrl.searchParams.get("date");
  if (!dateParam) {
    return NextResponse.json(
      { message: "날짜 파라미터(date)가 필요합니다" },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json(
      { message: "날짜 형식은 YYYY-MM-DD 이어야 합니다" },
      { status: 400 }
    );
  }

  const date = new Date(dateParam + "T00:00:00.000Z");

  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    if (products.length === 0) {
      return NextResponse.json({ inventory: [] });
    }

    const dailyInventories = await prisma.dailyInventory.findMany({
      where: {
        date,
        productId: { in: products.map((p) => p.id) },
      },
    });

    const inventoryByProductId = new Map(
      dailyInventories.map((inv) => [inv.productId, inv])
    );

    const inventory = products.map((product) => ({
      product,
      dailyInventory: inventoryByProductId.get(product.id) ?? null,
    }));

    return NextResponse.json({ inventory });
  } catch (_error) {
    return NextResponse.json(
      { message: "재고 정보를 불러오는데 실패했습니다" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "요청 본문이 올바르지 않습니다" }, { status: 400 });
  }

  const parsed = inventoryUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "입력값이 올바르지 않습니다", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { productId, date: dateString, ...inventoryFields } = parsed.data;
  const date = new Date(dateString + "T00:00:00.000Z");

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ message: "상품을 찾을 수 없습니다" }, { status: 404 });
  }

  try {
    const dailyInventory = await prisma.dailyInventory.upsert({
      where: { productId_date: { productId, date } },
      create: { productId, date, ...inventoryFields },
      update: { ...inventoryFields },
    });

    return NextResponse.json({ dailyInventory });
  } catch (_error) {
    return NextResponse.json(
      { message: "재고 정보 저장에 실패했습니다" },
      { status: 500 }
    );
  }
}
