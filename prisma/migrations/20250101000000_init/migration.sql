-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE IF NOT EXISTS "daily_records" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "bagelsBaked" INTEGER NOT NULL,
    "bagelsLeft" INTEGER NOT NULL,
    "storeSales" DOUBLE PRECISION NOT NULL,
    "uberSales" DOUBLE PRECISION NOT NULL,
    "doordashSales" DOUBLE PRECISION NOT NULL,
    "otherSales" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "daily_external_factors" (
    "id" TEXT NOT NULL,
    "dailyRecordId" TEXT NOT NULL,
    "weatherSummary" TEXT,
    "minTemp" DOUBLE PRECISION,
    "maxTemp" DOUBLE PRECISION,
    "rainMm" DOUBLE PRECISION,
    "windKph" DOUBLE PRECISION,
    "holidayName" TEXT,
    "localEventName" TEXT,
    "schoolHoliday" BOOLEAN NOT NULL DEFAULT false,
    "nzNewsSummary" TEXT,
    "worldNewsSummary" TEXT,

    CONSTRAINT "daily_external_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "prediction_weights" (
    "id" TEXT NOT NULL,
    "factorKey" TEXT NOT NULL,
    "weightValue" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,

    CONSTRAINT "prediction_weights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "app_settings" (
    "id" TEXT NOT NULL,
    "shopName" TEXT NOT NULL DEFAULT 'Bagels Beyond',
    "defaultTargetWasteRatio" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "defaultSafetyBuffer" DOUBLE PRECISION NOT NULL DEFAULT 1.1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sales_predictions" (
    "id" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "predictedSales" DOUBLE PRECISION NOT NULL,
    "predictedBagelsSold" INTEGER NOT NULL,
    "recommendedBagelsToBake" INTEGER NOT NULL,
    "predictedLeftovers" INTEGER NOT NULL,
    "confidenceScore" DOUBLE PRECISION,
    "method" TEXT NOT NULL DEFAULT 'rule_based_v1',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "prediction_factor_snapshots" (
    "id" TEXT NOT NULL,
    "salesPredictionId" TEXT NOT NULL,
    "factorKey" TEXT NOT NULL,
    "factorLabel" TEXT NOT NULL,
    "factorValue" TEXT NOT NULL,
    "appliedWeight" DOUBLE PRECISION NOT NULL,
    "impactScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_factor_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "import_jobs" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "import_rows" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawJson" TEXT NOT NULL,
    "parsedDate" TIMESTAMP(3),
    "parsedBagelsBaked" INTEGER,
    "parsedBagelsLeft" INTEGER,
    "parsedStoreSales" DOUBLE PRECISION,
    "parsedUberSales" DOUBLE PRECISION,
    "parsedDoordashSales" DOUBLE PRECISION,
    "parsedOtherSales" DOUBLE PRECISION,
    "parsedNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "validationErrors" TEXT,
    "linkedDailyRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "daily_records_date_key" ON "daily_records"("date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "daily_external_factors_dailyRecordId_key" ON "daily_external_factors"("dailyRecordId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "prediction_weights_factorKey_key" ON "prediction_weights"("factorKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sales_predictions_targetDate_idx" ON "sales_predictions"("targetDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "import_rows_jobId_idx" ON "import_rows"("jobId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "daily_external_factors" ADD CONSTRAINT "daily_external_factors_dailyRecordId_fkey" FOREIGN KEY ("dailyRecordId") REFERENCES "daily_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "prediction_factor_snapshots" ADD CONSTRAINT "prediction_factor_snapshots_salesPredictionId_fkey" FOREIGN KEY ("salesPredictionId") REFERENCES "sales_predictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
