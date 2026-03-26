import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireStaffOrAdmin, apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { generateOccurrencesForDate, generateOrdersFromOccurrences } from "@/lib/services/subscriptionService";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  const dateStr = req.nextUrl.searchParams.get("date");
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ message: "날짜를 입력해주세요 (YYYY-MM-DD)" }, { status: 400 });
  }

  const date = new Date(dateStr + "T00:00:00.000Z");

  try {
    const occurrences = await prisma.subscriptionOccurrence.findMany({
      where: { date },
      orderBy: { createdAt: "asc" },
      include: {
        subscription: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            items: { include: { product: { select: { id: true, name: true } } } },
          },
        },
        order: { select: { orderNumber: true, status: true } },
      },
    });
    return NextResponse.json({ occurrences });
  } catch {
    return NextResponse.json({ message: "발생 목록을 불러오지 못했습니다" }, { status: 500 });
  }
}

const postSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generateOrders: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "요청 본문이 올바르지 않습니다" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "입력 오류" }, { status: 400 });
  }

  const date = new Date(parsed.data.date + "T00:00:00.000Z");

  try {
    const occResult = await generateOccurrencesForDate(date);
    let orderResult = null;
    if (parsed.data.generateOrders) {
      orderResult = await generateOrdersFromOccurrences(date);
    }
    return NextResponse.json({ occurrences: occResult, orders: orderResult });
  } catch {
    return NextResponse.json({ message: "발생 생성 중 오류가 발생했습니다" }, { status: 500 });
  }
}
