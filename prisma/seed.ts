import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // AppSetting
  await prisma.appSetting.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      shopName: "Bagels Beyond",
      defaultTargetWasteRatio: 0.05,
      defaultSafetyBuffer: 1.1,
    },
  });

  // PredictionWeights
  const weights = [
    { factorKey: "weather_rain",   weightValue: -0.15, description: "비 오는 날 매출 감소" },
    { factorKey: "weather_hot",    weightValue: -0.05, description: "더운 날 매출 소폭 감소" },
    { factorKey: "monday",         weightValue: -0.1,  description: "월요일 매출 감소" },
    { factorKey: "tuesday",        weightValue: -0.05, description: "화요일 매출 소폭 감소" },
    { factorKey: "wednesday",      weightValue:  0.0,  description: "수요일 기준" },
    { factorKey: "thursday",       weightValue:  0.05, description: "목요일 매출 소폭 증가" },
    { factorKey: "friday",         weightValue:  0.1,  description: "금요일 매출 증가" },
    { factorKey: "saturday",       weightValue:  0.2,  description: "토요일 매출 증가" },
    { factorKey: "sunday",         weightValue:  0.15, description: "일요일 매출 증가" },
    { factorKey: "holiday",        weightValue:  0.3,  description: "공휴일 매출 증가" },
    { factorKey: "local_event",    weightValue:  0.2,  description: "지역 이벤트 매출 증가" },
    { factorKey: "school_holiday", weightValue:  0.1,  description: "방학 기간 매출 소폭 증가" },
    { factorKey: "nz_news",        weightValue: -0.05, description: "부정적 뉴질랜드 뉴스 영향" },
    { factorKey: "world_news",     weightValue: -0.03, description: "부정적 국제 뉴스 영향" },
  ];

  for (const w of weights) {
    await prisma.predictionWeight.upsert({
      where: { factorKey: w.factorKey },
      update: {},
      create: w,
    });
  }

  // Sample DailyRecords (recent 7 days with external factors)
  const today = new Date();
  const weatherOptions = ["맑음", "흐림", "비", "구름 조금"];
  const sampleData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - i));
    date.setHours(0, 0, 0, 0);
    return {
      date,
      bagelsBaked: 80 + Math.floor(Math.random() * 40),
      bagelsLeft:  Math.floor(Math.random() * 10),
      storeSales:  200 + Math.random() * 200,
      uberSales:   50  + Math.random() * 100,
      doordashSales: 30 + Math.random() * 80,
      otherSales:  Math.random() * 30,
    };
  });

  for (const data of sampleData) {
    const existing = await prisma.dailyRecord.findUnique({ where: { date: data.date } });
    if (!existing) {
      await prisma.dailyRecord.create({
        data: {
          ...data,
          storeSales:    Math.round(data.storeSales    * 100) / 100,
          uberSales:     Math.round(data.uberSales     * 100) / 100,
          doordashSales: Math.round(data.doordashSales * 100) / 100,
          otherSales:    Math.round(data.otherSales    * 100) / 100,
          externalFactor: {
            create: {
              weatherSummary: weatherOptions[Math.floor(Math.random() * weatherOptions.length)],
              minTemp:       10 + Math.random() * 5,
              maxTemp:       18 + Math.random() * 8,
              rainMm:        Math.random() > 0.7 ? Math.random() * 10 : 0,
              windKph:       10 + Math.random() * 20,
              schoolHoliday: false,
            },
          },
        },
      });
    }
  }

  // Sample SalesPredictions
  const predictionDates = [
    { daysAgo:  2, predictedSales: 450.0, predictedBagelsSold: 72, recommendedBagelsToBake: 80, predictedLeftovers: 8 },
    { daysAgo:  1, predictedSales: 520.0, predictedBagelsSold: 83, recommendedBagelsToBake: 90, predictedLeftovers: 7 },
    { daysAgo: -1, predictedSales: 480.0, predictedBagelsSold: 76, recommendedBagelsToBake: 85, predictedLeftovers: 9 },
  ];

  for (const pd of predictionDates) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - pd.daysAgo);
    targetDate.setHours(0, 0, 0, 0);

    const existing = await prisma.salesPrediction.findFirst({ where: { targetDate } });
    if (!existing) {
      await prisma.salesPrediction.create({
        data: {
          targetDate,
          predictedSales:          pd.predictedSales,
          predictedBagelsSold:     pd.predictedBagelsSold,
          recommendedBagelsToBake: pd.recommendedBagelsToBake,
          predictedLeftovers:      pd.predictedLeftovers,
          confidenceScore:         65 + Math.floor(Math.random() * 25),
          method: "rule_based_v1",
          notes: "최근 7일 데이터 기준 | 같은 요일 데이터 참고 | 적용 요인 2개",
          factorSnapshots: {
            create: [
              {
                factorKey:    "friday",
                factorLabel:  "요일 (friday)",
                factorValue:  "true",
                appliedWeight: 0.1,
                impactScore:  45.0,
              },
              {
                factorKey:    "weather_rain",
                factorLabel:  "비 (강수량)",
                factorValue:  "2.5mm",
                appliedWeight: -0.15,
                impactScore:  -67.5,
              },
            ],
          },
        },
      });
    }
  }

  // Sample ImportJob (CSV import, already imported)
  const existingImportJob = await prisma.importJob.findFirst();
  if (!existingImportJob) {
    await prisma.importJob.create({
      data: {
        fileName:    "sales_2024_jan.csv",
        status:      "imported",
        totalRows:   3,
        successRows: 3,
        failedRows:  0,
        rows: {
          create: [
            {
              rowNumber:          1,
              rawJson:            JSON.stringify({ date: "2024-01-10", bagelsBaked: "85", bagelsLeft: "6", storeSales: "260.00", uberSales: "85.00", doordashSales: "55.00", otherSales: "12.00" }),
              parsedDate:         new Date("2024-01-10T00:00:00.000Z"),
              parsedBagelsBaked:  85,
              parsedBagelsLeft:   6,
              parsedStoreSales:   260.0,
              parsedUberSales:    85.0,
              parsedDoordashSales: 55.0,
              parsedOtherSales:   12.0,
              status:             "imported",
            },
            {
              rowNumber:          2,
              rawJson:            JSON.stringify({ date: "2024-01-11", bagelsBaked: "90", bagelsLeft: "4", storeSales: "295.00", uberSales: "92.00", doordashSales: "65.00", otherSales: "18.00" }),
              parsedDate:         new Date("2024-01-11T00:00:00.000Z"),
              parsedBagelsBaked:  90,
              parsedBagelsLeft:   4,
              parsedStoreSales:   295.0,
              parsedUberSales:    92.0,
              parsedDoordashSales: 65.0,
              parsedOtherSales:   18.0,
              status:             "imported",
            },
            {
              rowNumber:          3,
              rawJson:            JSON.stringify({ date: "2024-01-12", bagelsBaked: "78", bagelsLeft: "9", storeSales: "230.00", uberSales: "75.00", doordashSales: "45.00", otherSales: "8.00" }),
              parsedDate:         new Date("2024-01-12T00:00:00.000Z"),
              parsedBagelsBaked:  78,
              parsedBagelsLeft:   9,
              parsedStoreSales:   230.0,
              parsedUberSales:    75.0,
              parsedDoordashSales: 45.0,
              parsedOtherSales:   8.0,
              status:             "imported",
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
