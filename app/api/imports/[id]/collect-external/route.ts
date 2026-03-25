import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { collectExternalFactorsForDateRange } from "@/lib/services/externalFactorService";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Find all DailyRecords created from this import job
    const rows = await prisma.importRow.findMany({
      where: { jobId: id, status: "imported", parsedDate: { not: null } },
      orderBy: { parsedDate: "asc" },
    });

    if (rows.length === 0) {
      return NextResponse.json({ message: "임포트된 행이 없습니다", totalDates: 0, processedDates: 0, errors: [] });
    }

    const dates = rows.map((r: { parsedDate: Date | null }) => new Date(r.parsedDate!));
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    const result = await collectExternalFactorsForDateRange(startDate, endDate);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "외부 데이터 수집에 실패했습니다";
    return NextResponse.json({ message }, { status: 500 });
  }
}
