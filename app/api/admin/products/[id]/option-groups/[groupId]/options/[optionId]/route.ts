import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { z } from "zod";

const optionPatchSchema = z.object({
  name: z.string().min(1, "옵션명을 입력해주세요").optional(),
  priceDelta: z.number().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  sku: z.string().optional().nullable(),
  tracksInventory: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string; optionId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id: productId, groupId, optionId } = await params;

  const option = await prisma.productOption.findFirst({
    where: { id: optionId, optionGroupId: groupId, optionGroup: { productId } },
  });
  if (!option) {
    return NextResponse.json({ message: "옵션을 찾을 수 없습니다" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "요청 본문이 올바르지 않습니다" }, { status: 400 });
  }

  const parsed = optionPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "입력값이 올바르지 않습니다", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.productOption.update({
      where: { id: optionId },
      data: parsed.data,
    });
    return NextResponse.json({ option: updated });
  } catch (_error) {
    return NextResponse.json({ message: "옵션 수정에 실패했습니다" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string; optionId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id: productId, groupId, optionId } = await params;

  const option = await prisma.productOption.findFirst({
    where: { id: optionId, optionGroupId: groupId, optionGroup: { productId } },
  });
  if (!option) {
    return NextResponse.json({ message: "옵션을 찾을 수 없습니다" }, { status: 404 });
  }

  try {
    await prisma.productOption.delete({ where: { id: optionId } });
    return NextResponse.json({ message: "옵션이 삭제되었습니다" });
  } catch (_error) {
    return NextResponse.json({ message: "옵션 삭제에 실패했습니다" }, { status: 500 });
  }
}
