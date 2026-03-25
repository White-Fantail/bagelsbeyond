import { weatherProvider, type WeatherData } from "./weather";
import { holidayProvider, type HolidayData } from "./holiday";
import { eventsProvider, type LocalEventData } from "./events";
import { newsProvider, type NewsSummaryData } from "./news";

export type ExternalFactors = {
  weather: WeatherData | null;
  holiday: HolidayData | null;
  events: LocalEventData[];
  news: NewsSummaryData | null;
};

export async function collectExternalFactors(date: Date): Promise<ExternalFactors> {
  const [weather, holiday, events, news] = await Promise.all([
    weatherProvider.fetchWeatherByDate(date).catch(() => null),
    holidayProvider.fetchHolidayByDate(date).catch(() => null),
    eventsProvider.fetchLocalEventsByDate(date).catch(() => []),
    newsProvider.fetchNewsSummaryByDate(date).catch(() => null),
  ]);

  return { weather, holiday, events, news };
}

export { weatherProvider, holidayProvider, eventsProvider, newsProvider };
export type { WeatherData, HolidayData, LocalEventData, NewsSummaryData };
