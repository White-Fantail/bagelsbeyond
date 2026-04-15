import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { getScraperSyncLogDetail } from "@/lib/services/scraperSyncService";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { logId } = await params;

  try {
    const log = await getScraperSyncLogDetail(logId);
    if (!log) {
      return NextResponse.json({ message: "Scraper sync log not found" }, { status: 404 });
    }
    return NextResponse.json({ log });
  } catch {
    return NextResponse.json(
      { message: "Failed to fetch scraper sync log" },
      { status: 500 }
    );
  }
}
