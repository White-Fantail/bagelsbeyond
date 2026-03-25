import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildPredictionInput, calculateRuleBasedPrediction, savePredictionResult } from "@/lib/services/predictionService";
import { ensureExternalFactorsForPredictionDate } from "@/lib/services/externalFactorService";
import { z } from "zod";

export async function GET() {
  try {
    const predictions = await prisma.salesPrediction.findMany({
      orderBy: { targetDate: "desc" },
      include: { factorSnapshots: true },
    });
    return NextResponse.json(predictions);
  } catch (_error) {
    return NextResponse.json({ message: "예측 목록을 불러오는데 실패했습니다" }, { status: 500 });
  }
}

const createPredictionSchema = z.object({
  targetDate: z.string().min(1, "날짜를 입력해주세요"),
  autoCollect: z.boolean().optional().default(true),
  externalFactors: z.object({
    weatherSummary: z.string().optional().nullable(),
    minTemp: z.number().optional().nullable(),
    maxTemp: z.number().optional().nullable(),
    rainMm: z.number().optional().nullable(),
    windKph: z.number().optional().nullable(),
    holidayName: z.string().optional().nullable(),
    localEventName: z.string().optional().nullable(),
    schoolHoliday: z.boolean().optional(),
    nzNewsSummary: z.string().optional().nullable(),
    worldNewsSummary: z.string().optional().nullable(),
  }).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createPredictionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "입력값이 올바르지 않습니다", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const targetDate = new Date(parsed.data.targetDate);
    targetDate.setHours(0, 0, 0, 0);

    // Auto-collect external factors if not provided and autoCollect is enabled
    let autoCollectResult: { existed: boolean; result: unknown } | null = null;
    if (parsed.data.autoCollect && !parsed.data.externalFactors) {
      autoCollectResult = await ensureExternalFactorsForPredictionDate(targetDate).catch(() => null);
    }

    const input = await buildPredictionInput(targetDate);

    // Override external factors if explicitly provided in request
    if (parsed.data.externalFactors) {
      Object.assign(input.externalFactors, parsed.data.externalFactors);
    }

    const result = calculateRuleBasedPrediction(input);
    const saved = await savePredictionResult(result);

    return NextResponse.json({ ...saved, autoCollectResult }, { status: 201 });
  } catch (_error) {
    console.error(_error);
    return NextResponse.json({ message: "예측 생성에 실패했습니다" }, { status: 500 });
  }
}
