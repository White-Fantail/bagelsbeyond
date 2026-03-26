import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { getProductionRecommendation } from "@/lib/services/production-recommendation";

export async function GET(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const dateParam = req.nextUrl.searchParams.get("date");
  if (!dateParam) {
    return NextResponse.json(
      { message: "날짜 파라미터(date)가 필요합니다" },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json(
      { message: "날짜 형식은 YYYY-MM-DD 이어야 합니다" },
      { status: 400 }
    );
  }

  const date = new Date(dateParam + "T00:00:00.000Z");

  try {
    const recommendation = await getProductionRecommendation(date);
    return NextResponse.json({ recommendation });
  } catch (error) {
    console.error("[production] 생산 추천 계산 실패:", error);
    return NextResponse.json(
      { message: "생산 추천 계산에 실패했습니다" },
      { status: 500 }
    );
  }
}
