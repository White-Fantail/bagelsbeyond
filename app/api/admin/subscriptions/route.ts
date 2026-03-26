import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireStaffOrAdmin, isNextResponse } from "@/lib/auth/dal";
import { SubscriptionStatus } from "@/app/generated/prisma/enums";

export async function GET(req: NextRequest) {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { searchParams } = req.nextUrl;
  const userId = searchParams.get("userId") ?? undefined;
  const status = searchParams.get("status") as SubscriptionStatus | null;

  const where: Record<string, unknown> = {};
  if (userId) where.userId = userId;
  if (status && Object.values(SubscriptionStatus).includes(status)) where.status = status;

  try {
    const subscriptions = await prisma.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: {
          include: { product: { select: { id: true, name: true } } },
        },
      },
    });
    return NextResponse.json({ subscriptions });
  } catch {
    return NextResponse.json({ message: "구독 목록을 불러오지 못했습니다" }, { status: 500 });
  }
}
