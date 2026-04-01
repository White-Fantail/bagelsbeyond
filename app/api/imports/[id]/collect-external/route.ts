import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { collectExternalFactorsForDateRange } from "@/lib/services/externalFactorService";
import { apiRequireStaffOrAdmin, isNextResponse } from "@/lib/auth/dal";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const { id } = await params;

    // Find all DailyRecords created from this import job
    const rows = await prisma.importRow.findMany({
      where: { jobId: id, status: "imported", parsedDate: { not: null } },
      orderBy: { parsedDate: "asc" },
    });

    if (rows.length === 0) {
      return NextResponse.json({ message: "No imported rows", totalDates: 0, processedDates: 0, errors: [] });
    }

    const dates = rows.map((r: { parsedDate: Date | null }) => new Date(r.parsedDate!));
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    const result = await collectExternalFactorsForDateRange(startDate, endDate);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "External Data Collection failed";
    return NextResponse.json({ message }, { status: 500 });
  }
}
