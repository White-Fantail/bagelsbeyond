import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { salesFormSchema } from "@/lib/validations";
import { Prisma } from "@/app/generated/prisma/client";
import { apiRequireStaffOrAdmin, isNextResponse } from "@/lib/auth/dal";

export async function GET() {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const records = await prisma.dailyRecord.findMany({ orderBy: { date: "desc" } });
    return NextResponse.json(records);
  } catch {
    return NextResponse.json({ message: "Failed to load data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  const parsed = salesFormSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid input", errors: parsed.error.flatten() }, { status: 400 });
  }

  const { date, bagelsBaked, bagelsLeft, storeSales, uberSales, doordashSales, otherSales, notes } = parsed.data;

  try {
    const record = await prisma.dailyRecord.create({
      data: {
        date: new Date(date),
        bagelsBaked,
        bagelsLeft,
        storeSales,
        uberSales,
        doordashSales,
        otherSales,
        notes: notes || null,
      },
    });
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.dailyRecord.findUnique({
        where: { date: new Date(date) },
        select: { id: true },
      });
      return NextResponse.json(
        { message: "A record already exists for this date.", existingId: existing?.id },
        { status: 409 }
      );
    }
    return NextResponse.json({ message: "Save failed" }, { status: 500 });
  }
}
