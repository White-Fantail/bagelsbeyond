import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { z } from "zod";

const productCreateSchema = z.object({
  name: z.string().min(1, "상품명을 입력해주세요"),
  slug: z
    .string()
    .min(1, "슬러그를 입력해주세요")
    .regex(/^[a-z0-9-]+$/, "슬러그는 소문자, 숫자, 하이픈만 사용할 수 있습니다"),
  description: z.string().optional(),
  loyverseCategoryId: z.string().optional().nullable(),
  basePrice: z.number().min(0, "가격은 0 이상이어야 합니다"),
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
      { message: "상품 목록을 불러오는데 실패했습니다" },
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

  const parsed = productCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "입력값이 올바르지 않습니다", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const existing = await prisma.product.findUnique({ where: { slug: data.slug } });
  if (existing) {
    return NextResponse.json(
      { message: "이미 사용 중인 슬러그입니다" },
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
      { message: "상품 생성에 실패했습니다" },
      { status: 500 }
    );
  }
}
