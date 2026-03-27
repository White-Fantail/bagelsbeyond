import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id: productId, groupId } = await params;

  try {
    await prisma.productOptionGroupAssignment.delete({
      where: { productId_optionGroupId: { productId, optionGroupId: groupId } },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "모디파이어 그룹 연결 해제에 실패했습니다" }, { status: 500 });
  }
}
