import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { salesFormSchema } from "@/lib/validations";
import { Prisma } from "@/app/generated/prisma/client";
import { apiRequireStaffOrAdmin, isNextResponse } from "@/lib/auth/dal";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const { id } = await params;
    const record = await prisma.dailyRecord.findUnique({ where: { id } });
    if (!record) return NextResponse.json({ message: "Record not found" }, { status: 404 });
    return NextResponse.json(record);
  } catch {
    return NextResponse.json({ message: "Failed to load data" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const { id } = await params;
    const parsed = salesFormSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid input", errors: parsed.error.flatten() }, { status: 400 });
    }

    const { date, bagelsBaked, bagelsLeft, storeSales, uberSales, doordashSales, otherSales, notes } = parsed.data;
    const record = await prisma.dailyRecord.update({
      where: { id },
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
    return NextResponse.json(record);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "A record already exists for this date. Please select a different date." }, { status: 409 });
    }
    return NextResponse.json({ message: "Edit failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const { id } = await params;
    await prisma.dailyRecord.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted" });
  } catch {
    return NextResponse.json({ message: "Delete failed" }, { status: 500 });
  }
}
