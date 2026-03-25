import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const prediction = await prisma.salesPrediction.findUnique({
      where: { id },
      include: { factorSnapshots: true },
    });

    if (!prediction) {
      return NextResponse.json({ message: "예측을 찾을 수 없습니다" }, { status: 404 });
    }

    // Also fetch actual DailyRecord for same date (for comparison)
    const targetDate = new Date(prediction.targetDate);
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    const actualRecord = await prisma.dailyRecord.findFirst({
      where: { date: { gte: start, lte: end } },
      include: { externalFactor: true },
    });

    return NextResponse.json({ prediction, actualRecord });
  } catch (_error) {
    return NextResponse.json({ message: "예측을 불러오는데 실패했습니다" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.salesPrediction.delete({ where: { id } });
    return NextResponse.json({ message: "삭제되었습니다" });
  } catch (_error) {
    return NextResponse.json({ message: "삭제에 실패했습니다" }, { status: 500 });
  }
}
