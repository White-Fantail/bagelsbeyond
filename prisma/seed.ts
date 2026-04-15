import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import bcrypt from "bcryptjs";

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
    { factorKey: "monday",         weightValue: -0.12, description: "Mon — quietest weekday" },
    { factorKey: "tuesday",        weightValue: -0.06, description: "Tue — below average" },
    { factorKey: "wednesday",      weightValue:  0.00, description: "Wed — baselineValue" },
    { factorKey: "thursday",       weightValue:  0.06, description: "Thu — slight increase before weekend" },
    { factorKey: "friday",         weightValue:  0.12, description: "Fri — anticipated pre-weekend demand increase" },
    { factorKey: "saturday",       weightValue:  0.22, description: "Sat — highest sales day" },
    { factorKey: "sunday",         weightValue:  0.18, description: "Sun — Weekend brunch demand" },
    // Weather
    { factorKey: "weather_rain",   weightValue: -0.15, description: "Rainy days — customer visit decrease" },
    { factorKey: "weather_hot",    weightValue: -0.05, description: "Hot day (28°C+) — slight decrease" },
    // Holiday
    { factorKey: "holiday",        weightValue:  0.28, description: "Holiday — outing customer increase" },
    // Events
    { factorKey: "local_event",    weightValue:  0.20, description: "Local Event — foot traffic increase" },
    { factorKey: "school_holiday", weightValue:  0.10, description: "School Holiday — family customer increase" },
    // News
    { factorKey: "nz_news",        weightValue: -0.05, description: "Negative NZ News impact" },
    { factorKey: "world_news",     weightValue: -0.03, description: "Negative World News impact" },
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

  const weatherOptions = ["Clear", "Cloudy", "Rain", "Partly Cloudy", "Clear", "Clear"];

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
        notes: isHoliday ? "Holiday" : isEvent ? "Local Event" : null,
        externalFactor: {
          create: {
            date,
            weatherSummary: isRainy ? "Rain" : weatherOptions[rndInt(0, 4)],
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
        { type: "baseline", text: `Recent 30-day avg. sales ($${Math.round(baselineSales).toLocaleString("en-NZ")}) used as baseline` },
        { type: "weekday", text: `${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dow]} day-of-week weights applied` },
        { type: "production", text: `recent Applying 10% buffer over predicted sold qty based on Waste Rate (${predictedBagelsSold} × 1.1 = ${recommendedBagelsToBake})` },
      ],
      summary: `Predicted Sales $${Math.round(predictedSales).toLocaleString("en-NZ")}, recommended production: ${recommendedBagelsToBake} (based on Sold: ${predictedBagelsSold})`,
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
        notes: `Baseline data: recent 30 days | same-day 4 data points reference | Applied Factor: 1`,
        adjustmentSummary: `${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dow]} Day Weights Reflected`,
        explanationJson: JSON.stringify(explanation),
        factorSnapshots: {
          create: [
            {
              factorKey:     ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][dow],
              factorLabel:   `Day (${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dow]})`,
              factorValue:   ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dow],
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

  const futureWeatherOptions = ["Clear", "Partly Cloudy", "Cloudy"];
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

  // ── ScheduledTask / TaskLog samples ────────────────────────────────────────
  const existingTaskCount = await prisma.scheduledTask.count();
  if (existingTaskCount === 0) {
    const now = new Date();

    // 1. Success: external factor collection (2 days ago)
    const date2DaysAgo = new Date(today);
    date2DaysAgo.setDate(today.getDate() - 2);
    const t1 = await prisma.scheduledTask.create({
      data: {
        taskType: "collect_external_factors",
        targetDate: date2DaysAgo,
        status: "success",
        startedAt: new Date(now.getTime() - 60_000),
        finishedAt: new Date(now.getTime() - 59_000),
        resultSummary: "Target: 1 day | Processed: 1 day",
        retryCount: 0,
      },
    });
    await prisma.taskLog.createMany({
      data: [
        { scheduledTaskId: t1.id, message: `ExternalFactor Collect Started: ${date2DaysAgo.toISOString().split("T")[0]}`, level: "info" },
        { scheduledTaskId: t1.id, message: "Collection complete: weather, holiday, schoolHoliday", level: "info" },
      ],
    });

    // 2. Partial: external factor collection (yesterday) — news provider failed
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const t2 = await prisma.scheduledTask.create({
      data: {
        taskType: "collect_external_factors",
        targetDate: yesterday,
        status: "partial",
        startedAt: new Date(now.getTime() - 30_000),
        finishedAt: new Date(now.getTime() - 29_000),
        resultSummary: "Target: 1 day | Processed: 1 day | Failed provider: news",
        retryCount: 0,
      },
    });
    await prisma.taskLog.createMany({
      data: [
        { scheduledTaskId: t2.id, message: `ExternalFactor Collect Started: ${yesterday.toISOString().split("T")[0]}`, level: "info" },
        { scheduledTaskId: t2.id, message: "News provider error: API key is not configured", level: "warning" },
        { scheduledTaskId: t2.id, message: "Partial Success: 1 provider Failed", level: "warning" },
      ],
    });

    // 3. Success: prediction generation (yesterday)
    const t3 = await prisma.scheduledTask.create({
      data: {
        taskType: "generate_prediction",
        targetDate: yesterday,
        status: "success",
        startedAt: new Date(now.getTime() - 20_000),
        finishedAt: new Date(now.getTime() - 18_000),
        resultSummary: "Predictions Create Completed | PredictedSales: 342",
        retryCount: 0,
      },
    });
    await prisma.taskLog.createMany({
      data: [
        { scheduledTaskId: t3.id, message: `Predictions Create Started: ${yesterday.toISOString().split("T")[0]}`, level: "info" },
        { scheduledTaskId: t3.id, message: "Using existing ExternalFactor", level: "info" },
        { scheduledTaskId: t3.id, message: "Predictions Create Completed: PredictedSales=342", level: "info" },
      ],
    });

    // 4. Failed: prediction generation (3 days ago) — no data
    const date3DaysAgo = new Date(today);
    date3DaysAgo.setDate(today.getDate() - 3);
    const t4 = await prisma.scheduledTask.create({
      data: {
        taskType: "generate_prediction",
        targetDate: date3DaysAgo,
        status: "failed",
        startedAt: new Date(now.getTime() - 90_000),
        finishedAt: new Date(now.getTime() - 89_500),
        errorMessage: "Insufficient data: no recent records",
        resultSummary: "Predictions Failed",
        retryCount: 1,
      },
    });
    await prisma.taskLog.createMany({
      data: [
        { scheduledTaskId: t4.id, message: `Predictions Create Started: ${date3DaysAgo.toISOString().split("T")[0]}`, level: "info" },
        { scheduledTaskId: t4.id, message: "Exception: Insufficient data: no recent records", level: "error" },
      ],
    });

    // 5. Pending: tomorrow external factors
    await prisma.scheduledTask.create({
      data: {
        taskType: "collect_external_factors",
        targetDate: new Date(today.getTime() + 86400_000),
        status: "pending",
        retryCount: 0,
      },
    });
  }


  // ── Ingredient Categories ────────────────────────────────────────────────────
  const ingredientCategories = [
    { name: "Bakery Base",  slug: "bakery-base",  sortOrder: 1 },
    { name: "Dairy",        slug: "dairy",         sortOrder: 2 },
    { name: "Produce",      slug: "produce",       sortOrder: 3 },
    { name: "Packaging",    slug: "packaging",     sortOrder: 4 },
  ];

  const categoryMap: Record<string, string> = {};

  for (const cat of ingredientCategories) {
    const row = await prisma.ingredientCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, sortOrder: cat.sortOrder },
      create: { name: cat.name, slug: cat.slug, sortOrder: cat.sortOrder, isActive: true },
    });
    categoryMap[cat.slug] = row.id;
    console.log(`  📂 Category: ${cat.name}`);
  }

  // ── Sample Ingredients ───────────────────────────────────────────────────────
  type UnitTypeStr = "G" | "KG" | "ML" | "L" | "EA" | "PACK" | "BOX";

  const sampleIngredients: {
    name: string;
    categorySlug: string;
    description: string;
    purchasePrice: string;
    purchaseQuantity: string;
    purchaseUnit: UnitTypeStr;
    baseUnit: UnitTypeStr;
    taxIncluded: boolean;
  }[] = [
    {
      name: "High Gluten Flour",
      categorySlug: "bakery-base",
      description: "Strong bread flour for bagel production",
      purchasePrice: "32.50",
      purchaseQuantity: "25.000",
      purchaseUnit: "KG",
      baseUnit: "G",
      taxIncluded: false,
    },
    {
      name: "Cream Cheese",
      categorySlug: "dairy",
      description: "Full-fat cream cheese for bagel fillings",
      purchasePrice: "8.90",
      purchaseQuantity: "1.000",
      purchaseUnit: "KG",
      baseUnit: "G",
      taxIncluded: true,
    },
    {
      name: "Smoked Salmon",
      categorySlug: "produce",
      description: "Cold-smoked salmon slices",
      purchasePrice: "28.00",
      purchaseQuantity: "500.000",
      purchaseUnit: "G",
      baseUnit: "G",
      taxIncluded: true,
    },
    {
      name: "Paper Bag",
      categorySlug: "packaging",
      description: "Branded paper bags for takeaway orders",
      purchasePrice: "18.50",
      purchaseQuantity: "500.000",
      purchaseUnit: "PACK",
      baseUnit: "EA",
      taxIncluded: true,
    },
  ];

  for (const ing of sampleIngredients) {
    const existing = await prisma.ingredient.findFirst({ where: { name: ing.name } });
    if (!existing) {
      await prisma.ingredient.create({
        data: {
          name: ing.name,
          categoryId: categoryMap[ing.categorySlug],
          description: ing.description,
          purchasePrice: ing.purchasePrice,
          purchaseQuantity: ing.purchaseQuantity,
          purchaseUnit: ing.purchaseUnit,
          baseUnit: ing.baseUnit,
          taxIncluded: ing.taxIncluded,
          isActive: true,
        },
      });
      console.log(`  🧂 Ingredient: ${ing.name}`);
    }
  }

  console.log("✅ Seeding complete!");
}

// ─── Test users ──────────────────────────────────────────────────────────────
// Default passwords are for development only.
// IMPORTANT: Change all passwords before deploying to production!
async function seedUsers() {
  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD ?? "Dev@12345!";
  const hash = await bcrypt.hash(defaultPassword, 12);

  const users = [
    { email: "admin@example.com",    name: "Admin User",    role: "ADMIN"    as const },
    { email: "staff@example.com",    name: "Staff User",    role: "STAFF"    as const },
    { email: "customer@example.com", name: "Customer User", role: "CUSTOMER" as const },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, isActive: true },
      create: { email: u.email, name: u.name, role: u.role, passwordHash: hash, isActive: true },
    });
    console.log(`  👤 ${u.role}: ${u.email}`);
  }
}


main()
  .then(() => seedUsers())
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
