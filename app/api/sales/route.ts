import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { salesFormSchema } from "@/lib/validations";
import { Prisma } from "@/app/generated/prisma/client";

export async function GET() {
  try {
    const records = await prisma.dailyRecord.findMany({
      orderBy: { date: "desc" },
      include: { externalFactor: true },
    });
    return NextResponse.json(records);
  } catch (_error) {
    return NextResponse.json({ message: "데이터를 불러오는데 실패했습니다" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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

    const hasExternalFactor =
      weatherSummary || minTemp !== undefined || maxTemp !== undefined ||
      rainMm !== undefined || windKph !== undefined || holidayName ||
      localEventName || schoolHoliday || nzNewsSummary || worldNewsSummary;

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
        ...(hasExternalFactor && {
          externalFactor: {
            create: {
              date: new Date(date),
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
            },
          },
        }),
      },
      include: { externalFactor: true },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (_error) {
    console.error(_error);
    if (_error instanceof Prisma.PrismaClientKnownRequestError && _error.code === "P2002") {
      return NextResponse.json({ message: "이미 해당 날짜의 기록이 있습니다. 해당 날짜의 기록을 수정하려면 수정 페이지를 이용해주세요." }, { status: 409 });
    }
    return NextResponse.json({ message: "저장에 실패했습니다" }, { status: 500 });
  }
}
