import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";

export async function GET() {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const categories = await prisma.loyverseCategory.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, color: true, isVisible: true, displayOrder: true, updatedAt: true },
    });

    return NextResponse.json({ categories });
  } catch (_error) {
    return NextResponse.json(
      { message: "Failed to load categories list" },
      { status: 500 }
    );
  }
}
