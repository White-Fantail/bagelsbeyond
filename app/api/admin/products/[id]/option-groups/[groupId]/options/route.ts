import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { z } from "zod";

const optionCreateSchema = z.object({
  name: z.string().min(1, "옵션명을 입력해주세요"),
  priceDelta: z.number().default(0),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  sku: z.string().optional().nullable(),
  tracksInventory: z.boolean().default(false),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id: productId, groupId } = await params;

  const group = await prisma.productOptionGroup.findFirst({
    where: { id: groupId, productId },
  });
  if (!group) {
    return NextResponse.json({ message: "옵션 그룹을 찾을 수 없습니다" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "요청 본문이 올바르지 않습니다" }, { status: 400 });
  }

  const parsed = optionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "입력값이 올바르지 않습니다", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const option = await prisma.productOption.create({
      data: { optionGroupId: groupId, ...parsed.data },
    });
    return NextResponse.json({ option }, { status: 201 });
  } catch (_error) {
    return NextResponse.json({ message: "옵션 생성에 실패했습니다" }, { status: 500 });
  }
}
