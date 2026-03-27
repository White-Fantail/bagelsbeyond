import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { upsertExternalFactorsByDate } from "@/lib/services/externalFactorService";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ date: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { date: dateParam } = await params;
    const date = new Date(`${dateParam}T00:00:00.000Z`);

    if (isNaN(date.getTime())) {
      return NextResponse.json({ message: "Invalid date" }, { status: 400 });
    }

    const factor = await prisma.dailyExternalFactor.findUnique({ where: { date } });
    if (!factor) {
      return NextResponse.json({ message: "External data not found" }, { status: 404 });
    }

    return NextResponse.json(factor);
  } catch {
    return NextResponse.json({ message: "External Failed to load data" }, { status: 500 });
  }
}

// POST /api/external-factors/[date] — collect/refresh external factors for a date
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { date: dateParam } = await params;
    const date = new Date(`${dateParam}T00:00:00.000Z`);

    if (isNaN(date.getTime())) {
      return NextResponse.json({ message: "Invalid date" }, { status: 400 });
    }

    const result = await upsertExternalFactorsByDate(date);
    const factor = await prisma.dailyExternalFactor.findUnique({ where: { date } });

    return NextResponse.json({ result, factor });
  } catch (error) {
    const message = error instanceof Error ? error.message : "External Data Collection failed";
    return NextResponse.json({ message }, { status: 500 });
  }
}
