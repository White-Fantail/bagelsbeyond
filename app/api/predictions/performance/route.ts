import { NextResponse } from "next/server";
import { getPredictionPerformanceStats } from "@/lib/services/predictionService";

export async function GET() {
  try {
    const stats = await getPredictionPerformanceStats();
    return NextResponse.json(stats);
  } catch (_error) {
    return NextResponse.json({ message: "성과 데이터를 불러오는데 실패했습니다" }, { status: 500 });
  }
}
