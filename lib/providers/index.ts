import { prisma } from "@/lib/db";
import { weatherProvider, type WeatherData } from "./weather";
import { holidayProvider, type HolidayData } from "./holiday";
import { eventsProvider, type LocalEventData } from "./events";
import { newsProvider, type NewsSummaryData } from "./news";
import { schoolHolidayProvider, type SchoolHolidayData } from "./school-holiday";

export type ExternalFactors = {
  weather: WeatherData | null;
  holiday: HolidayData | null;
  events: LocalEventData[];
  news: NewsSummaryData | null;
  schoolHoliday: SchoolHolidayData | null;
};

// ─── Collect for a single date ─────────────────────────────────────────────────

export async function collectExternalFactors(date: Date): Promise<ExternalFactors> {
  const [weather, holiday, events, news, schoolHoliday] = await Promise.all([
    weatherProvider.fetchWeatherByDate(date).catch(() => null),
    holidayProvider.fetchHolidayByDate(date).catch(() => null),
    eventsProvider.fetchLocalEventsByDate(date).catch(() => []),
    newsProvider.fetchNewsSummaryByDate(date).catch(() => null),
    schoolHolidayProvider.fetchSchoolHolidayByDate(date).catch(() => null),
  ]);

  return { weather, holiday, events, news, schoolHoliday };
}

// ─── Save external factors to DailyExternalFactor for a DailyRecord ───────────

export async function saveExternalFactorsForRecord(
  dailyRecordId: string,
  factors: ExternalFactors
): Promise<void> {
  const { weather, holiday, events, news, schoolHoliday } = factors;

  const data = {
    weatherSummary: weather?.summary ?? null,
    minTemp: weather?.minTemp ?? null,
    maxTemp: weather?.maxTemp ?? null,
    rainMm: weather?.rainMm ?? null,
    windKph: weather?.windKph ?? null,
    holidayName: holiday?.name ?? null,
    localEventName: events.length > 0 ? events.map((e) => e.name).join(", ") : null,
    schoolHoliday: schoolHoliday?.isHoliday ?? false,
    nzNewsSummary: news?.nzSummary ?? null,
    worldNewsSummary: news?.worldSummary ?? null,
  };

  await prisma.dailyExternalFactor.upsert({
    where: { dailyRecordId },
    update: data,
    create: { dailyRecordId, ...data },
  });
}

// ─── Refresh external factors for a single DailyRecord ────────────────────────

export async function refreshExternalFactorsForRecord(recordId: string): Promise<void> {
  const record = await prisma.dailyRecord.findUnique({ where: { id: recordId } });
  if (!record) throw new Error(`DailyRecord not found: ${recordId}`);

  const factors = await collectExternalFactors(new Date(record.date));
  await saveExternalFactorsForRecord(recordId, factors);
}

// ─── Collect for a date range (e.g. after CSV import) ─────────────────────────

export async function collectExternalFactorsForDateRange(
  startDate: Date,
  endDate: Date
): Promise<{ processed: number; errors: string[] }> {
  const records = await prisma.dailyRecord.findMany({
    where: { date: { gte: startDate, lte: endDate } },
    orderBy: { date: "asc" },
  });

  let processed = 0;
  const errors: string[] = [];

  for (const record of records) {
    try {
      const factors = await collectExternalFactors(new Date(record.date));
      await saveExternalFactorsForRecord(record.id, factors);
      processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      errors.push(`${record.date.toISOString().split("T")[0]}: ${msg}`);
    }
  }

  return { processed, errors };
}

export { weatherProvider, holidayProvider, eventsProvider, newsProvider, schoolHolidayProvider };
export type { WeatherData, HolidayData, LocalEventData, NewsSummaryData, SchoolHolidayData };
