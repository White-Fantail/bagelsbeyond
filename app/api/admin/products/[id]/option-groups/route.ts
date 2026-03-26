import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { z } from "zod";

const optionGroupCreateSchema = z.object({
  name: z.string().min(1, "옵션 그룹명을 입력해주세요"),
  minSelect: z.number().int().min(0).default(0),
  maxSelect: z.number().int().min(1).default(1),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id: productId } = await params;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ message: "상품을 찾을 수 없습니다" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "요청 본문이 올바르지 않습니다" }, { status: 400 });
  }

  const parsed = optionGroupCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "입력값이 올바르지 않습니다", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const group = await prisma.productOptionGroup.create({
      data: { productId, ...parsed.data },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });
    return NextResponse.json({ group }, { status: 201 });
  } catch (_error) {
    return NextResponse.json({ message: "옵션 그룹 생성에 실패했습니다" }, { status: 500 });
  }
}
