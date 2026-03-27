import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = {};
    if (from || to) {
      where.date = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const factors = await prisma.dailyExternalFactor.findMany({
      where,
      orderBy: { date: "desc" },
      take: 100,
    });

    return NextResponse.json(factors);
  } catch {
    return NextResponse.json({ message: "External Failed to load data" }, { status: 500 });
  }
}
