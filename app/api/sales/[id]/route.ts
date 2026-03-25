import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { salesFormSchema } from "@/lib/validations";
import { Prisma } from "@/app/generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const record = await prisma.dailyRecord.findUnique({
      where: { id },
      include: { externalFactor: true },
    });
    if (!record) {
      return NextResponse.json({ message: "기록을 찾을 수 없습니다" }, { status: 404 });
    }
    return NextResponse.json(record);
  } catch (_error) {
    return NextResponse.json({ message: "데이터를 불러오는데 실패했습니다" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = salesFormSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "입력값이 올바르지 않습니다", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      date,
      bagelsBaked,
      bagelsLeft,
      storeSales,
      uberSales,
      doordashSales,
      otherSales,
      notes,
      weatherSummary,
      minTemp,
      maxTemp,
      rainMm,
      windKph,
      holidayName,
      localEventName,
      schoolHoliday,
      nzNewsSummary,
      worldNewsSummary,
    } = parsed.data;

    const externalData = {
      weatherSummary: weatherSummary || null,
      minTemp: minTemp ?? null,
      maxTemp: maxTemp ?? null,
      rainMm: rainMm ?? null,
      windKph: windKph ?? null,
      holidayName: holidayName || null,
      localEventName: localEventName || null,
      schoolHoliday: schoolHoliday ?? false,
      nzNewsSummary: nzNewsSummary || null,
      worldNewsSummary: worldNewsSummary || null,
    };

    const dailyRecord = await prisma.dailyRecord.findUnique({ where: { id } });
    if (!dailyRecord) {
      return NextResponse.json({ message: "기록을 찾을 수 없습니다" }, { status: 404 });
    }

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
        externalFactor: {
          upsert: {
            create: { ...externalData, date: new Date(date) },
            update: externalData,
          },
        },
      },
      include: { externalFactor: true },
    });

    return NextResponse.json(record);
  } catch (_error) {
    console.error(_error);
    if (_error instanceof Prisma.PrismaClientKnownRequestError && _error.code === "P2002") {
      return NextResponse.json({ message: "이미 해당 날짜의 기록이 있습니다. 다른 날짜를 선택해주세요." }, { status: 409 });
    }
    return NextResponse.json({ message: "수정에 실패했습니다" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    await prisma.dailyRecord.delete({ where: { id } });
    return NextResponse.json({ message: "삭제되었습니다" });
  } catch (_error) {
    return NextResponse.json({ message: "삭제에 실패했습니다" }, { status: 500 });
  }
}
