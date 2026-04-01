import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireStaffOrAdmin, isNextResponse } from "@/lib/auth/dal";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const { id } = await params;
    const prediction = await prisma.salesPrediction.findUnique({
      where: { id },
      include: { factorSnapshots: true },
    });

    if (!prediction) {
      return NextResponse.json({ message: "Prediction not found" }, { status: 404 });
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
    return NextResponse.json({ message: "Failed to load prediction" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const { id } = await params;
    await prisma.salesPrediction.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted" });
  } catch (_error) {
    return NextResponse.json({ message: "Delete failed" }, { status: 500 });
  }
}
