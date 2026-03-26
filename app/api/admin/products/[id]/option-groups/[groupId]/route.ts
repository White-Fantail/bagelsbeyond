import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { z } from "zod";

const optionGroupPatchSchema = z.object({
  name: z.string().min(1, "옵션 그룹명을 입력해주세요").optional(),
  minSelect: z.number().int().min(0).optional(),
  maxSelect: z.number().int().min(1).optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
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

  const parsed = optionGroupPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "입력값이 올바르지 않습니다", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.productOptionGroup.update({
      where: { id: groupId },
      data: parsed.data,
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });
    return NextResponse.json({ group: updated });
  } catch (_error) {
    return NextResponse.json({ message: "옵션 그룹 수정에 실패했습니다" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
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

  try {
    await prisma.productOptionGroup.delete({ where: { id: groupId } });
    return NextResponse.json({ message: "옵션 그룹이 삭제되었습니다" });
  } catch (_error) {
    return NextResponse.json({ message: "옵션 그룹 삭제에 실패했습니다" }, { status: 500 });
  }
}
