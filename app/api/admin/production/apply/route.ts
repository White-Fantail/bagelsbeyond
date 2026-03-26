import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { z } from "zod";

const applySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식은 YYYY-MM-DD 이어야 합니다"),
  productRecommendations: z
    .array(
      z.object({
        productId: z.string().min(1),
        recommendedQty: z.number().int().min(0),
      })
    )
    .min(1, "상품별 추천 수량이 필요합니다"),
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

  const parsed = applySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "입력값이 올바르지 않습니다", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { date: dateString, productRecommendations } = parsed.data;
  const date = new Date(dateString + "T00:00:00.000Z");

  try {
    const results = await Promise.all(
      productRecommendations.map((rec) =>
        prisma.dailyInventory.upsert({
          where: { productId_date: { productId: rec.productId, date } },
          create: { productId: rec.productId, date, plannedQty: rec.recommendedQty },
          update: { plannedQty: rec.recommendedQty },
        })
      )
    );

    return NextResponse.json({
      updated: results.length,
      message: "생산 계획이 저장되었습니다",
    });
  } catch (error) {
    console.error("[production/apply] 생산 계획 저장 실패:", error);
    return NextResponse.json(
      { message: "생산 계획 저장에 실패했습니다" },
      { status: 500 }
    );
  }
}
