/**
 * External Factor Service
 *
 * Collects data from all providers and upserts into DailyExternalFactor.
 * Designed to be called from API routes, post-import hooks, and (future) cron jobs.
 *
 * Key design points:
 * - All operations are date-based (not record-based)
 * - Partial success is supported: failure of one provider does not block others
 * - Each upsert uses date as the unique key (DailyRecord link is optional)
 * - Results include per-provider status for transparency in UI
 */

import { prisma } from "@/lib/db";
import {
  weatherProvider,
  holidayProvider,
  eventsProvider,
  newsProvider,
  schoolHolidayProvider,
} from "@/lib/providers";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ProviderName = "weather" | "holiday" | "schoolHoliday" | "events" | "news";

export type CollectionResult = {
  date: string;
  success: boolean;
  collectedFields: string[];
  failedProviders: ProviderName[];
  skippedProviders: ProviderName[];
  warnings: string[];
};

export type RangeCollectionResult = {
  totalDates: number;
  processedDates: number;
  failedDates: number;
  results: CollectionResult[];
  errors: string[];
};

// ─── Location options (read from settings or env) ─────────────────────────────

export type LocationOptions = {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  region?: string;
  countryCode?: string;
};

function getDefaultLocationOptions(): LocationOptions {
  return {
    latitude: process.env.DEFAULT_LATITUDE ? parseFloat(process.env.DEFAULT_LATITUDE) : -43.5321,
    longitude: process.env.DEFAULT_LONGITUDE ? parseFloat(process.env.DEFAULT_LONGITUDE) : 172.6362,
    timezone: process.env.DEFAULT_TIMEZONE ?? "Pacific/Auckland",
    region: process.env.DEFAULT_REGION ?? "Canterbury",
    countryCode: process.env.DEFAULT_COUNTRY_CODE ?? "NZ",
  };
}

// ─── Core collection function ──────────────────────────────────────────────────

/**
 * Collect external factors for a single date and upsert into DB.
 * Partial failures are allowed — whatever succeeds is saved.
 */
export async function upsertExternalFactorsByDate(
  date: Date,
  locationOptions?: LocationOptions
): Promise<CollectionResult> {
  const loc = { ...getDefaultLocationOptions(), ...locationOptions };
  const dateKey = date.toISOString().split("T")[0];
  const now = new Date();

  const collectedFields: string[] = [];
  const failedProviders: ProviderName[] = [];
  const skippedProviders: ProviderName[] = [];
  const warnings: string[] = [];

  // Collect from all providers concurrently; never let one failure block others
  const [weatherResult, holidayResult, schoolHolidayResult, eventsResult, newsResult] =
    await Promise.allSettled([
      weatherProvider.fetchWeatherByDate(date, {
        latitude: loc.latitude,
        longitude: loc.longitude,
        timezone: loc.timezone,
      }),
      holidayProvider.fetchHolidayByDate(date, { countryCode: loc.countryCode }),
      schoolHolidayProvider.fetchSchoolHolidayByDate(date, { region: loc.region }),
      eventsProvider.fetchLocalEventsByDate(date, { region: loc.region }),
      newsProvider.fetchNewsSummaryByDate(date),
    ]);

  // --- Weather ---
  let weatherData: {
    weatherSummary?: string | null;
    minTemp?: number | null;
    maxTemp?: number | null;
    rainMm?: number | null;
    windKph?: number | null;
    sourceWeather?: string | null;
  } = {};
  if (weatherResult.status === "fulfilled" && weatherResult.value) {
    const w = weatherResult.value;
    weatherData = {
      weatherSummary: w.summary,
      minTemp: w.minTemp,
      maxTemp: w.maxTemp,
      rainMm: w.rainMm,
      windKph: w.windKph,
      sourceWeather: "open-meteo",
    };
    collectedFields.push("weather");
  } else if (weatherResult.status === "rejected") {
    failedProviders.push("weather");
    const reason = String(weatherResult.reason);
    warnings.push(`Weather provider error: ${reason}`);
    // Store explicit failure marker so the UI can show a warning even without re-collecting
    weatherData = {
      weatherSummary: null,
      minTemp: null,
      maxTemp: null,
      rainMm: null,
      windKph: null,
      sourceWeather: "open-meteo:failed",
    };
    console.error(`[externalFactor] weather 실패 | date=${dateKey} | reason=${reason}`);
  } else {
    // Provider returned null (no data available for this date, e.g. too far in the future)
    skippedProviders.push("weather");
    weatherData = { sourceWeather: null };
    console.warn(`[externalFactor] weather 데이터 없음 (null 반환) | date=${dateKey}`);
  }

  // --- Holiday ---
  let holidayData: { holidayName?: string | null; sourceHoliday?: string | null } = {};
  if (holidayResult.status === "fulfilled" && holidayResult.value) {
    holidayData = {
      holidayName: holidayResult.value.name,
      sourceHoliday: "nager.at",
    };
    collectedFields.push("holiday");
  } else if (holidayResult.status === "rejected") {
    failedProviders.push("holiday");
    warnings.push(`Holiday provider error: ${String(holidayResult.reason)}`);
  } else {
    holidayData = { holidayName: null, sourceHoliday: "nager.at" };
    collectedFields.push("holiday");
  }

  // --- School Holiday ---
  let schoolData: { schoolHoliday?: boolean; sourceEvents?: string | null } = {};
  if (schoolHolidayResult.status === "fulfilled" && schoolHolidayResult.value) {
    schoolData = { schoolHoliday: schoolHolidayResult.value.isHoliday };
    collectedFields.push("schoolHoliday");
  } else if (schoolHolidayResult.status === "rejected") {
    failedProviders.push("schoolHoliday");
    warnings.push(`School holiday provider error: ${String(schoolHolidayResult.reason)}`);
  } else {
    skippedProviders.push("schoolHoliday");
  }

  // --- Events ---
  let eventsData: { localEventName?: string | null; sourceEvents?: string | null } = {};
  if (eventsResult.status === "fulfilled") {
    const events = eventsResult.value;
    eventsData = {
      localEventName: events.length > 0 ? events.map((e) => e.name).join(", ") : null,
      sourceEvents: events.length > 0 ? "placeholder" : null,
    };
    if (events.length > 0) collectedFields.push("events");
    else skippedProviders.push("events");
  } else {
    failedProviders.push("events");
    warnings.push(`Events provider error: ${String(eventsResult.reason)}`);
  }

  // --- News ---
  let newsData: {
    nzNewsSummary?: string | null;
    worldNewsSummary?: string | null;
    sourceNews?: string | null;
  } = {};
  if (newsResult.status === "fulfilled" && newsResult.value) {
    const n = newsResult.value;
    newsData = {
      nzNewsSummary: n.nzSummary ?? null,
      worldNewsSummary: n.worldSummary ?? null,
      sourceNews: "newsapi",
    };
    collectedFields.push("news");
  } else if (newsResult.status === "rejected") {
    failedProviders.push("news");
    warnings.push(`News provider error: ${String(newsResult.reason)}`);
  } else {
    skippedProviders.push("news");
    newsData = { sourceNews: null };
  }

  // Find the linked DailyRecord for this date (if any)
  const linkedRecord = await prisma.dailyRecord.findUnique({ where: { date } }).catch(() => null);

  const upsertData = {
    ...weatherData,
    ...holidayData,
    schoolHoliday: schoolData.schoolHoliday ?? false,
    ...eventsData,
    ...newsData,
    dailyRecordId: linkedRecord?.id ?? null,
    collectedAt: now,
    lastRefreshedAt: now,
  };

  try {
    console.log(
      `[externalFactor] upsert 시작 | date=${dateKey}` +
      ` | weatherSummary=${upsertData.weatherSummary ?? "null"}` +
      ` | minTemp=${upsertData.minTemp ?? "null"}` +
      ` | maxTemp=${upsertData.maxTemp ?? "null"}` +
      ` | rainMm=${upsertData.rainMm ?? "null"}` +
      ` | windKph=${upsertData.windKph ?? "null"}` +
      ` | sourceWeather=${upsertData.sourceWeather ?? "null"}`
    );
    await prisma.dailyExternalFactor.upsert({
      where: { date },
      update: { ...upsertData, updatedAt: now },
      create: { date, ...upsertData },
    });
  } catch (err) {
    return {
      date: dateKey,
      success: false,
      collectedFields,
      failedProviders,
      skippedProviders,
      warnings: [...warnings, `DB upsert failed: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  return {
    date: dateKey,
    success: true,
    collectedFields,
    failedProviders,
    skippedProviders,
    warnings,
  };
}

// ─── Convenience wrappers ──────────────────────────────────────────────────────

/**
 * Alias matching the existing API surface used by providers/index.ts
 */
export async function collectExternalFactors(
  date: Date,
  locationOptions?: LocationOptions
): Promise<CollectionResult> {
  return upsertExternalFactorsByDate(date, locationOptions);
}

/**
 * Collect external factors for every date in a range (inclusive).
 * Only dates that have a DailyRecord are processed.
 */
export async function collectExternalFactorsForDateRange(
  startDate: Date,
  endDate: Date,
  locationOptions?: LocationOptions
): Promise<RangeCollectionResult> {
  const records = await prisma.dailyRecord.findMany({
    where: { date: { gte: startDate, lte: endDate } },
    orderBy: { date: "asc" },
  });

  const results: CollectionResult[] = [];
  const errors: string[] = [];
  let processedDates = 0;
  let failedDates = 0;

  for (const record of records) {
    try {
      const result = await upsertExternalFactorsByDate(new Date(record.date), locationOptions);
      results.push(result);
      if (result.success) processedDates++;
      else failedDates++;
    } catch (err) {
      const msg = `${record.date.toISOString().split("T")[0]}: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      failedDates++;
    }
  }

  return {
    totalDates: records.length,
    processedDates,
    failedDates,
    results,
    errors,
  };
}

/**
 * Collect external factors for a specific DailyRecord (by recordId).
 */
export async function refreshExternalFactorsForRecord(
  recordId: string,
  locationOptions?: LocationOptions
): Promise<CollectionResult> {
  const record = await prisma.dailyRecord.findUnique({ where: { id: recordId } });
  if (!record) throw new Error(`DailyRecord not found: ${recordId}`);
  return upsertExternalFactorsByDate(new Date(record.date), locationOptions);
}

/**
 * Ensure external factors exist for a prediction date.
 * Creates a standalone DailyExternalFactor if one doesn't exist yet.
 */
export async function ensureExternalFactorsForPredictionDate(
  date: Date,
  locationOptions?: LocationOptions
): Promise<{ existed: boolean; result: CollectionResult | null }> {
  const existing = await prisma.dailyExternalFactor.findUnique({ where: { date } });
  if (existing) return { existed: true, result: null };

  const result = await upsertExternalFactorsByDate(date, locationOptions);
  return { existed: false, result };
}
