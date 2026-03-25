export type WeatherData = {
  summary: string;
  minTemp: number;
  maxTemp: number;
  rainMm: number;
  windKph: number;
};

export interface WeatherProvider {
  fetchWeatherByDate(date: Date): Promise<WeatherData | null>;
}

// TODO: Replace with real API provider (e.g. OpenWeatherMap, WeatherAPI.com)
// Set WEATHER_API_KEY in .env and implement RealWeatherProvider
export class MockWeatherProvider implements WeatherProvider {
  async fetchWeatherByDate(_date: Date): Promise<WeatherData | null> {
    // Fallback mock - returns null to indicate no data available
    return null;
  }
}

export const weatherProvider: WeatherProvider = new MockWeatherProvider();
