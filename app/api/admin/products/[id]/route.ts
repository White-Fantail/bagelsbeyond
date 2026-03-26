import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { IntegrationSource, ProductCategory } from "@/app/generated/prisma/enums";
import { z } from "zod";

const productPatchSchema = z.object({
  name: z.string().min(1, "상품명을 입력해주세요").optional(),
  slug: z
    .string()
    .min(1, "슬러그를 입력해주세요")
    .regex(/^[a-z0-9-]+$/, "슬러그는 소문자, 숫자, 하이픈만 사용할 수 있습니다")
    .optional(),
  description: z.string().optional().nullable(),
  category: z.nativeEnum(ProductCategory).optional(),
  basePrice: z.number().min(0, "가격은 0 이상이어야 합니다").optional(),
  isActive: z.boolean().optional(),
  isSubscriptionEligible: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

/** Fields that cannot be changed on a Loyverse-synced product */
const LOYVERSE_READONLY_FIELDS = ["name", "slug", "description", "category", "basePrice"] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        optionGroups: {
          orderBy: { sortOrder: "asc" },
          include: {
            options: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ message: "상품을 찾을 수 없습니다" }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (_error) {
    return NextResponse.json(
      { message: "상품 정보를 불러오는데 실패했습니다" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "요청 본문이 올바르지 않습니다" }, { status: 400 });
  }

  const parsed = productPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "입력값이 올바르지 않습니다", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const existing = await prisma.product.findUnique({
    where: { id },
    include: {
      externalMappings: {
        where: { source: IntegrationSource.LOYVERSE },
        select: { id: true },
      },
    },
  });
  if (!existing) {
    return NextResponse.json({ message: "상품을 찾을 수 없습니다" }, { status: 404 });
  }

  const isLoyverseSynced = existing.externalMappings.length > 0;

  // Block changes to Loyverse read-only fields
  if (isLoyverseSynced) {
    const attemptedReadOnly = LOYVERSE_READONLY_FIELDS.filter(
      (field) => field in data && data[field] !== undefined
    );
    if (attemptedReadOnly.length > 0) {
      return NextResponse.json(
        {
          message: `Loyverse sync 상품의 원본 필드는 수정할 수 없습니다: ${attemptedReadOnly.join(", ")}`,
          readOnlyFields: attemptedReadOnly,
        },
        { status: 403 }
      );
    }
  }

  if (data.slug && data.slug !== existing.slug) {
    const slugConflict = await prisma.product.findUnique({ where: { slug: data.slug } });
    if (slugConflict) {
      return NextResponse.json(
        { message: "이미 사용 중인 슬러그입니다" },
        { status: 409 }
      );
    }
  }

  try {
    const product = await prisma.product.update({
      where: { id },
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

    return NextResponse.json({ product });
  } catch (_error) {
    return NextResponse.json(
      { message: "상품 수정에 실패했습니다" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ message: "상품을 찾을 수 없습니다" }, { status: 404 });
  }

  try {
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ message: "상품이 삭제되었습니다" });
  } catch (_error) {
    return NextResponse.json(
      { message: "상품 삭제에 실패했습니다" },
      { status: 500 }
    );
  }
}
