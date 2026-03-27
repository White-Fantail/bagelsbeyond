import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";

export async function GET() {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const categories = await prisma.loyverseCategory.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    });

    return NextResponse.json({ categories });
  } catch (_error) {
    return NextResponse.json(
      { message: "카테고리 목록을 불러오는데 실패했습니다" },
      { status: 500 }
    );
  }
}
