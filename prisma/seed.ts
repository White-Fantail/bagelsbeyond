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
    { factorKey: "weather_rain", weightValue: -0.15, description: "비 오는 날 매출 감소" },
    { factorKey: "weather_hot", weightValue: -0.05, description: "더운 날 매출 소폭 감소" },
    { factorKey: "monday", weightValue: -0.1, description: "월요일 매출 감소" },
    { factorKey: "tuesday", weightValue: -0.05, description: "화요일 매출 소폭 감소" },
    { factorKey: "wednesday", weightValue: 0.0, description: "수요일 기준" },
    { factorKey: "thursday", weightValue: 0.05, description: "목요일 매출 소폭 증가" },
    { factorKey: "friday", weightValue: 0.1, description: "금요일 매출 증가" },
    { factorKey: "saturday", weightValue: 0.2, description: "토요일 매출 증가" },
    { factorKey: "sunday", weightValue: 0.15, description: "일요일 매출 증가" },
    { factorKey: "holiday", weightValue: 0.3, description: "공휴일 매출 증가" },
    { factorKey: "local_event", weightValue: 0.2, description: "지역 이벤트 매출 증가" },
    { factorKey: "school_holiday", weightValue: 0.1, description: "방학 기간 매출 소폭 증가" },
    { factorKey: "nz_news", weightValue: -0.05, description: "부정적 뉴질랜드 뉴스 영향" },
    { factorKey: "world_news", weightValue: -0.03, description: "부정적 국제 뉴스 영향" },
  ];

  for (const w of weights) {
    await prisma.predictionWeight.upsert({
      where: { factorKey: w.factorKey },
      update: {},
      create: w,
    });
  }

  // Sample DailyRecords
  const today = new Date();
  const sampleData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - i));
    date.setHours(0, 0, 0, 0);
    return {
      date,
      bagelsBaked: 80 + Math.floor(Math.random() * 40),
      bagelsLeft: Math.floor(Math.random() * 10),
      storeSales: 200 + Math.random() * 200,
      uberSales: 50 + Math.random() * 100,
      doordashSales: 30 + Math.random() * 80,
      otherSales: Math.random() * 30,
    };
  });

  for (const data of sampleData) {
    const existing = await prisma.dailyRecord.findUnique({ where: { date: data.date } });
    if (!existing) {
      await prisma.dailyRecord.create({
        data: {
          ...data,
          storeSales: Math.round(data.storeSales * 100) / 100,
          uberSales: Math.round(data.uberSales * 100) / 100,
          doordashSales: Math.round(data.doordashSales * 100) / 100,
          otherSales: Math.round(data.otherSales * 100) / 100,
          externalFactor: {
            create: {
              weatherSummary: ["맑음", "흐림", "비", "구름 조금"][Math.floor(Math.random() * 4)],
              minTemp: 10 + Math.random() * 5,
              maxTemp: 18 + Math.random() * 8,
              rainMm: Math.random() > 0.7 ? Math.random() * 10 : 0,
              windKph: 10 + Math.random() * 20,
              schoolHoliday: false,
            },
          },
        },
      });
    }
  }

  console.log("✅ Seeding complete!");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
