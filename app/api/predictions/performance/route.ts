import { NextResponse } from "next/server";
import { getPredictionPerformanceStats } from "@/lib/services/predictionService";

export async function GET() {
  try {
    const stats = await getPredictionPerformanceStats();
    return NextResponse.json(stats);
  } catch (_error) {
    return NextResponse.json({ message: "Performance Failed to load data" }, { status: 500 });
  }
}
