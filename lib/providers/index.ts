// Re-export providers for direct use
export { weatherProvider } from "./weather";
export { holidayProvider } from "./holiday";
export { eventsProvider } from "./events";
export { newsProvider } from "./news";
export { schoolHolidayProvider } from "./school-holiday";

export type { WeatherData } from "./weather";
export type { HolidayData } from "./holiday";
export type { LocalEventData } from "./events";
export type { NewsSummaryData } from "./news";
export type { SchoolHolidayData } from "./school-holiday";

// Re-export service layer functions for backwards compatibility
export {
  collectExternalFactors,
  collectExternalFactorsForDateRange,
  refreshExternalFactorsForRecord,
  ensureExternalFactorsForPredictionDate,
  upsertExternalFactorsByDate,
} from "@/lib/services/externalFactorService";

export type {
  CollectionResult,
  RangeCollectionResult,
  LocationOptions,
} from "@/lib/services/externalFactorService";
