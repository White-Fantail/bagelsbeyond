import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { z } from "zod";

const inventoryUpsertSchema = z.object({
  productId: z.string().min(1, "Please enter a Product ID"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date format must be YYYY-MM-DD"),
  plannedQty: z.number().int().min(0, "Quantity must be 0 or more"),
  bakedQty: z.number().int().min(0, "Quantity must be 0 or more"),
  reservedQty: z.number().int().min(0, "Quantity must be 0 or more"),
  soldQty: z.number().int().min(0, "Quantity must be 0 or more"),
  isSoldOut: z.boolean(),
  note: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const dateParam = req.nextUrl.searchParams.get("date");
  if (!dateParam) {
    return NextResponse.json(
      { message: "Date parameter is required" },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json(
      { message: "Date format must be YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const date = new Date(dateParam + "T00:00:00.000Z");

  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        loyverseCategory: { select: { name: true } },
      },
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
      { message: "Failed to load inventory info" },
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
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = inventoryUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { productId, date: dateString, ...inventoryFields } = parsed.data;
  const date = new Date(dateString + "T00:00:00.000Z");

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ message: "Product not found" }, { status: 404 });
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
      { message: "Failed to save inventory info" },
      { status: 500 }
    );
  }
}
