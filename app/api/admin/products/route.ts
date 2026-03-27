import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { z } from "zod";

const productCreateSchema = z.object({
  name: z.string().min(1, "Product Please enter your name"),
  slug: z
    .string()
    .min(1, "Please enter a slug")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  description: z.string().optional(),
  loyverseCategoryId: z.string().optional().nullable(),
  basePrice: z.number().min(0, "Price must be 0 or more"),
  isActive: z.boolean().default(true),
  isSubscriptionEligible: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export async function GET() {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const products = await prisma.product.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        optionGroups: {
          orderBy: { sortOrder: "asc" },
          include: {
            options: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });

    return NextResponse.json({ products });
  } catch (_error) {
    return NextResponse.json(
      { message: "Failed to load products list" },
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

  const parsed = productCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const existing = await prisma.product.findUnique({ where: { slug: data.slug } });
  if (existing) {
    return NextResponse.json(
      { message: "Slug is already in use" },
      { status: 409 }
    );
  }

  try {
    const product = await prisma.product.create({
      data,
      include: {
        optionGroups: {
          orderBy: { sortOrder: "asc" },
          include: {
            options: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (_error) {
    return NextResponse.json(
      { message: "Failed to create product" },
      { status: 500 }
    );
  }
}
