import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const lastSync = await prisma.syncJob.findFirst({
    where: { channel: "LOYVERSE" },
    orderBy: { startedAt: "desc" },
  });
  return NextResponse.json({ lastSync });
}
