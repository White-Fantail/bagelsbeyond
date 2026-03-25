import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

function rnd(min: number, max: number) {
  return min + Math.random() * (max - min);
}
function rndInt(min: number, max: number) {
  return Math.floor(rnd(min, max + 1));
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function main() {
  console.log("🌱 Seeding database...");

  // ── AppSetting ──────────────────────────────────────────────────────────────
  await prisma.appSetting.upsert({
    where: { id: "default" },
    update: {
      shopName: "Bagels Beyond",
      defaultTargetWasteRatio: 0.05,
      defaultSafetyBuffer: 1.1,
      defaultRegion: "Canterbury",
      defaultCity: "Christchurch",
      defaultCountry: "NZ",
      defaultEventRegion: "Christchurch",
      autoCollectExternalData: true,
    },
    create: {
      id: "default",
      shopName: "Bagels Beyond",
      defaultTargetWasteRatio: 0.05,
      defaultSafetyBuffer: 1.1,
      defaultRegion: "Canterbury",
      defaultCity: "Christchurch",
      defaultCountry: "NZ",
      defaultEventRegion: "Christchurch",
      autoCollectExternalData: true,
    },
  });

  // ── PredictionWeights ───────────────────────────────────────────────────────
  const weights = [
    // Weekday
    { factorKey: "monday",         weightValue: -0.12, description: "월요일 — 주중 가장 조용한 날" },
    { factorKey: "tuesday",        weightValue: -0.06, description: "화요일 — 평균 아래" },
    { factorKey: "wednesday",      weightValue:  0.00, description: "수요일 — 기준값" },
    { factorKey: "thursday",       weightValue:  0.06, description: "목요일 — 주말 전 소폭 증가" },
    { factorKey: "friday",         weightValue:  0.12, description: "금요일 — 주말 기대 수요 증가" },
    { factorKey: "saturday",       weightValue:  0.22, description: "토요일 — 가장 매출 높은 날" },
    { factorKey: "sunday",         weightValue:  0.18, description: "일요일 — 주말 브런치 수요" },
    // Weather
    { factorKey: "weather_rain",   weightValue: -0.15, description: "비 오는 날 — 방문 고객 감소" },
    { factorKey: "weather_hot",    weightValue: -0.05, description: "더운 날 (28°C+) — 소폭 감소" },
    // Holiday
    { factorKey: "holiday",        weightValue:  0.28, description: "공휴일 — 나들이 고객 증가" },
    // Events
    { factorKey: "local_event",    weightValue:  0.20, description: "지역 이벤트 — 유동 인구 증가" },
    { factorKey: "school_holiday", weightValue:  0.10, description: "학교 방학 — 가족 고객 증가" },
    // News
    { factorKey: "nz_news",        weightValue: -0.05, description: "부정적 뉴질랜드 뉴스 영향" },
    { factorKey: "world_news",     weightValue: -0.03, description: "부정적 국제 뉴스 영향" },
  ];

  for (const w of weights) {
    await prisma.predictionWeight.upsert({
      where: { factorKey: w.factorKey },
      update: { weightValue: w.weightValue, description: w.description },
      create: w,
    });
  }

  // ── DailyRecords (last 35 days) ─────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weatherOptions = ["맑음", "흐림", "비", "구름 조금", "맑음", "맑음"];

  // Day of week multipliers (0=Sun..6=Sat)
  const dowMultiplier = [1.18, 0.88, 0.94, 1.0, 1.06, 1.12, 1.22];

  for (let i = 34; i >= 1; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const existing = await prisma.dailyRecord.findUnique({ where: { date } });
    if (existing) continue;

    const dow = date.getDay();
    const mult = dowMultiplier[dow];
    const isRainy = Math.random() < 0.2;
    const isHoliday = i === 14 || i === 21; // simulate two holidays
    const isEvent = i === 7;

    let baseSales = rnd(280, 420);
    baseSales *= mult;
    if (isRainy) baseSales *= 0.85;
    if (isHoliday) baseSales *= 1.3;
    if (isEvent) baseSales *= 1.2;

    const storePct = rnd(0.50, 0.62);
    const uberPct = rnd(0.20, 0.28);
    const ddPct = rnd(0.10, 0.18);
    const otherPct = 1 - storePct - uberPct - ddPct;

    const totalSales = baseSales;
    const bagelsSold = rndInt(Math.floor(totalSales / 5.5), Math.floor(totalSales / 4.5));
    const bagelsLeft = Math.max(0, rndInt(2, isHoliday ? 6 : 12));
    const bagelsBaked = bagelsSold + bagelsLeft;

    await prisma.dailyRecord.create({
      data: {
        date,
        bagelsBaked,
        bagelsLeft,
        storeSales:    round2(totalSales * storePct),
        uberSales:     round2(totalSales * uberPct),
        doordashSales: round2(totalSales * ddPct),
        otherSales:    round2(Math.max(0, totalSales * otherPct)),
        notes: isHoliday ? "공휴일" : isEvent ? "지역 이벤트" : null,
        externalFactor: {
          create: {
            date,
            weatherSummary: isRainy ? "비" : weatherOptions[rndInt(0, 4)],
            minTemp:   round2(rnd(8, 16)),
            maxTemp:   round2(rnd(16, 26)),
            rainMm:    isRainy ? round2(rnd(1, 15)) : 0,
            windKph:   round2(rnd(5, 25)),
            holidayName:    isHoliday ? (i === 14 ? "Wellington Anniversary Day" : "Waitangi Day") : null,
            localEventName: isEvent ? "Wellington Night Market" : null,
            schoolHoliday:  i >= 7 && i <= 14,
            sourceWeather:  "seed",
            sourceHoliday:  "seed",
            collectedAt:    date,
            lastRefreshedAt: date,
          },
        },
      },
    });
  }

  // ── SalesPredictions (for past 5 days + tomorrow) ───────────────────────────
  const predictionTargets = [
    { daysOffset: -5, salesPct: 0.97 },
    { daysOffset: -4, salesPct: 1.03 },
    { daysOffset: -3, salesPct: 0.92 },
    { daysOffset: -2, salesPct: 1.08 },
    { daysOffset: -1, salesPct: 0.95 },
    { daysOffset: 1,  salesPct: 1.0  }, // tomorrow
  ];

  for (const pt of predictionTargets) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + pt.daysOffset);
    targetDate.setHours(0, 0, 0, 0);

    const existing = await prisma.salesPrediction.findFirst({ where: { targetDate } });
    if (existing) continue;

    const dow = targetDate.getDay();
    const mult = dowMultiplier[dow];
    const baseSales = 340 * mult * pt.salesPct;
    const predictedSales = round2(baseSales);
    const predictedBagelsSold = rndInt(Math.floor(baseSales / 5.5), Math.floor(baseSales / 5.0));
    const recommendedBagelsToBake = Math.round(predictedBagelsSold * 1.1);
    const predictedLeftovers = recommendedBagelsToBake - predictedBagelsSold;
    const baselineSales = round2(340 * mult);

    const explanation = {
      items: [
        { type: "baseline", text: `최근 30일 평균 매출이 기준값(${Math.round(baselineSales).toLocaleString("ko-KR")}원)으로 사용됨` },
        { type: "weekday", text: `${["일요일","월요일","화요일","수요일","목요일","금요일","토요일"][dow]} 요일 가중치가 반영됨` },
        { type: "production", text: `최근 폐기율을 고려해 판매량 대비 10% 버퍼 적용 (${predictedBagelsSold}개 × 1.1 = ${recommendedBagelsToBake}개)` },
      ],
      summary: `예상 매출 ${Math.round(predictedSales).toLocaleString("ko-KR")}원, 판매 ${predictedBagelsSold}개 기준으로 ${recommendedBagelsToBake}개 생산을 추천합니다.`,
    };

    await prisma.salesPrediction.create({
      data: {
        targetDate,
        predictedSales,
        predictedBagelsSold,
        recommendedBagelsToBake,
        predictedLeftovers,
        projectedWasteRate:       round2(predictedLeftovers / recommendedBagelsToBake),
        projectedSellThroughRate: round2(predictedBagelsSold / recommendedBagelsToBake),
        baselineSales,
        baselineBagelsSold:       rndInt(55, 75),
        confidenceScore:          rndInt(60, 85),
        method: "rule_based_v2",
        notes: `기준 데이터: 최근 30일 | 같은 요일 4건 참고 | 적용 요인: 1개`,
        adjustmentSummary: `${["일요일","월요일","화요일","수요일","목요일","금요일","토요일"][dow]} 요일 가중치 반영`,
        explanationJson: JSON.stringify(explanation),
        factorSnapshots: {
          create: [
            {
              factorKey:     ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][dow],
              factorLabel:   `요일 (${["일요일","월요일","화요일","수요일","목요일","금요일","토요일"][dow]})`,
              factorValue:   ["일요일","월요일","화요일","수요일","목요일","금요일","토요일"][dow],
              appliedWeight: [0.18, -0.12, -0.06, 0.0, 0.06, 0.12, 0.22][dow],
              impactScore:   round2(baselineSales * [0.18, -0.12, -0.06, 0.0, 0.06, 0.12, 0.22][dow]),
            },
          ],
        },
      },
    });
  }

  // ── Standalone DailyExternalFactor for future dates (for prediction preview) ─
  const futureDates = [1, 2, 3].map((n) => {
    const d = new Date(today);
    d.setDate(today.getDate() + n);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const futureWeatherOptions = ["맑음", "구름 조금", "흐림"];
  for (let fi = 0; fi < futureDates.length; fi++) {
    const futureDate = futureDates[fi];
    const existing = await prisma.dailyExternalFactor.findUnique({ where: { date: futureDate } });
    if (!existing) {
      await prisma.dailyExternalFactor.create({
        data: {
          date: futureDate,
          weatherSummary: futureWeatherOptions[fi % 3],
          minTemp: round2(rnd(10, 15)),
          maxTemp: round2(rnd(17, 23)),
          rainMm: 0,
          windKph: round2(rnd(8, 18)),
          holidayName: null,
          schoolHoliday: false,
          sourceWeather: "seed",
          sourceHoliday: "seed",
          collectedAt: today,
          lastRefreshedAt: today,
        },
      });
    }
  }

  // ── Sample ImportJob ────────────────────────────────────────────────────────
  const existingImport = await prisma.importJob.findFirst();
  if (!existingImport) {
    await prisma.importJob.create({
      data: {
        fileName: "sales_history_sample.csv",
        status: "imported",
        totalRows: 3,
        successRows: 3,
        failedRows: 0,
        rows: {
          create: [
            {
              rowNumber: 1,
              rawJson: JSON.stringify({ date: "2024-12-01", bagelsBaked: "90", bagelsLeft: "5", storeSales: "280.00", uberSales: "95.00", doordashSales: "60.00", otherSales: "15.00" }),
              parsedDate: new Date("2024-12-01T00:00:00.000Z"),
              parsedBagelsBaked: 90,
              parsedBagelsLeft: 5,
              parsedStoreSales: 280.0,
              parsedUberSales: 95.0,
              parsedDoordashSales: 60.0,
              parsedOtherSales: 15.0,
              status: "imported",
            },
            {
              rowNumber: 2,
              rawJson: JSON.stringify({ date: "2024-12-02", bagelsBaked: "95", bagelsLeft: "4", storeSales: "310.00", uberSales: "105.00", doordashSales: "70.00", otherSales: "20.00" }),
              parsedDate: new Date("2024-12-02T00:00:00.000Z"),
              parsedBagelsBaked: 95,
              parsedBagelsLeft: 4,
              parsedStoreSales: 310.0,
              parsedUberSales: 105.0,
              parsedDoordashSales: 70.0,
              parsedOtherSales: 20.0,
              status: "imported",
            },
            {
              rowNumber: 3,
              rawJson: JSON.stringify({ date: "2024-12-03", bagelsBaked: "80", bagelsLeft: "8", storeSales: "240.00", uberSales: "80.00", doordashSales: "50.00", otherSales: "10.00" }),
              parsedDate: new Date("2024-12-03T00:00:00.000Z"),
              parsedBagelsBaked: 80,
              parsedBagelsLeft: 8,
              parsedStoreSales: 240.0,
              parsedUberSales: 80.0,
              parsedDoordashSales: 50.0,
              parsedOtherSales: 10.0,
              status: "imported",
            },
          ],
        },
      },
    });
  }

  console.log("✅ Seeding complete!");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
