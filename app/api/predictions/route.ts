import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildPredictionInput, calculateRuleBasedPrediction, savePredictionResult } from "@/lib/services/predictionService";
import { ensureExternalFactorsForPredictionDate } from "@/lib/services/externalFactorService";
import { apiRequireStaffOrAdmin, isNextResponse } from "@/lib/auth/dal";
import { createPredictionSchema } from "@/lib/validations";

export async function GET() {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const predictions = await prisma.salesPrediction.findMany({
      orderBy: { targetDate: "desc" },
      include: { factorSnapshots: true },
    });
    return NextResponse.json(predictions);
  } catch (_error) {
    return NextResponse.json({ message: "Failed to load predictions list" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const body = await req.json();
    const parsed = createPredictionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid input", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const targetDate = new Date(parsed.data.targetDate);
    targetDate.setHours(0, 0, 0, 0);

    const dateStr = targetDate.toISOString().split("T")[0];
    console.log(`[prediction] POST /api/predictions — targetDate=${dateStr}, autoCollect=${parsed.data.autoCollect}`);

    // Step 1: Auto-collect external factors for the target date if not provided manually.
    // This MUST happen before buildPredictionInput so the freshly collected data is available.
    let autoCollectResult: { existed: boolean; result: unknown } | null = null;
    if (parsed.data.autoCollect && !parsed.data.externalFactors) {
      try {
        autoCollectResult = await ensureExternalFactorsForPredictionDate(targetDate);
        console.log(`[prediction] ensureExternalFactors result — existed=${autoCollectResult.existed}`);
      } catch (collectErr) {
        // Log the error but don't block prediction — factors may still exist from a previous run
        console.error(`[prediction] External factor collection failed for ${dateStr}:`, collectErr);
        autoCollectResult = null;
      }
    }

    // Step 2: Build prediction input (will pick up the just-collected external factors)
    const input = await buildPredictionInput(targetDate);

    console.log(`[prediction] buildPredictionInput — recentRecords=${input.recentRecords.length}, sameDayRecords=${input.sameDayRecords.length}, hasExternalFactors=${!!(input.externalFactors.weatherSummary || input.externalFactors.rainMm !== undefined)}`);

    // Step 3: Override external factors if explicitly provided in the request
    if (parsed.data.externalFactors) {
      Object.assign(input.externalFactors, parsed.data.externalFactors);
      console.log(`[prediction] External factors overridden by request body`);
    }

    // Step 4: Calculate and save prediction
    const result = calculateRuleBasedPrediction(input);
    const saved = await savePredictionResult(result);

    console.log(`[prediction] Saved prediction id=${saved.id}, predictedSales=${saved.predictedSales}, confidence=${saved.confidenceScore}`);

    return NextResponse.json({ ...saved, autoCollectResult }, { status: 201 });
  } catch (error) {
    console.error("[prediction] Unhandled error:", error);
    return NextResponse.json({ message: "Failed to create prediction" }, { status: 500 });
  }
}
