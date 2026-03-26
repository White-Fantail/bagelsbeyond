export type WeatherData = {
  summary: string;
  minTemp: number;
  maxTemp: number;
  rainMm: number;
  windKph: number;
};

export interface WeatherProvider {
  fetchWeatherByDate(date: Date, options?: WeatherProviderOptions): Promise<WeatherData | null>;
}

export type WeatherProviderOptions = {
  latitude?: number;
  longitude?: number;
  timezone?: string;
};

// Default location: Christchurch / Addington, Canterbury, NZ
const DEFAULT_LATITUDE = -43.5321;
const DEFAULT_LONGITUDE = 172.6362;
const DEFAULT_TIMEZONE = "Pacific/Auckland";

// WMO weather code to Korean summary
function wmoToSummary(code: number): string {
  if (code === 0) return "맑음";
  if (code <= 2) return "구름 조금";
  if (code === 3) return "흐림";
  if (code <= 49) return "안개";
  if (code <= 59) return "이슬비";
  if (code <= 69) return "비";
  if (code <= 79) return "눈";
  if (code <= 84) return "소나기";
  if (code <= 99) return "천둥번개";
  return "알 수 없음";
}

// Open-Meteo provider — free, no API key required
// Supports both historical (archive) and forecast data
// Docs: https://open-meteo.com/en/docs
export class OpenMeteoWeatherProvider implements WeatherProvider {
  async fetchWeatherByDate(
    date: Date,
    options: WeatherProviderOptions = {}
  ): Promise<WeatherData | null> {
    const lat = options.latitude ?? DEFAULT_LATITUDE;
    const lon = options.longitude ?? DEFAULT_LONGITUDE;
    // NOTE: Do NOT call encodeURIComponent here — URLSearchParams handles encoding automatically.
    // Pre-encoding causes double-encoding: "Pacific/Auckland" → "Pacific%2FAuckland" via
    // encodeURIComponent, then URLSearchParams encodes "%" → "%25", giving the invalid
    // "Pacific%252FAuckland" that Open-Meteo rejects with a 400 error.
    const tz = options.timezone ?? DEFAULT_TIMEZONE;
    const dateStr = date.toISOString().split("T")[0];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPast = date < today;

    // TODO: Allow override via OPEN_METEO_BASE_URL env variable for self-hosted instances
    const baseUrl = isPast
      ? "https://archive-api.open-meteo.com/v1/archive"
      : "https://api.open-meteo.com/v1/forecast";

    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      start_date: dateStr,
      end_date: dateStr,
      daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode",
      timezone: tz,
    });

    console.log(
      `[weather] 요청 시작 | date=${dateStr} | isPast=${isPast} | lat=${lat} | lon=${lon} | tz=${tz} | url=${baseUrl}?${params.toString()}`
    );

    try {
      const res = await fetch(`${baseUrl}?${params.toString()}`, {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(8000),
      });

      console.log(`[weather] 응답 수신 | date=${dateStr} | status=${res.status}`);

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`Weather API ${res.status}: ${errBody.slice(0, 200)}`);
      }

      const json = await res.json() as {
        daily?: {
          temperature_2m_max?: number[];
          temperature_2m_min?: number[];
          precipitation_sum?: number[];
          windspeed_10m_max?: number[];
          weathercode?: number[];
        };
      };

      const d = json.daily;
      if (!d) {
        console.warn(`[weather] daily 데이터 없음 | date=${dateStr}`);
        return null;
      }

      const maxTemp = d.temperature_2m_max?.[0] ?? null;
      const minTemp = d.temperature_2m_min?.[0] ?? null;
      const rainMm = d.precipitation_sum?.[0] ?? 0;
      const windKph = d.windspeed_10m_max?.[0] ?? 0;
      const wmoCode = d.weathercode?.[0] ?? 0;

      if (maxTemp == null || minTemp == null) {
        console.warn(`[weather] 온도 없음 | date=${dateStr} | maxTemp=${maxTemp} | minTemp=${minTemp}`);
        return null;
      }

      const result: WeatherData = {
        summary: wmoToSummary(wmoCode),
        minTemp: Math.round(minTemp * 10) / 10,
        maxTemp: Math.round(maxTemp * 10) / 10,
        rainMm: Math.round(rainMm * 10) / 10,
        windKph: Math.round(windKph * 10) / 10,
      };

      console.log(
        `[weather] 파싱 완료 | date=${dateStr} | summary=${result.summary} | minTemp=${result.minTemp} | maxTemp=${result.maxTemp} | rainMm=${result.rainMm} | windKph=${result.windKph}`
      );

      return result;
    } catch (err) {
      // Re-throw so the service layer records this as a provider failure (not a silent skip)
      console.error(
        `[weather] 오류 | date=${dateStr} | error=${err instanceof Error ? err.message : String(err)}`
      );
      throw err;
    }
  }
}

// Fallback mock — returns null to signal no data available
export class MockWeatherProvider implements WeatherProvider {
  async fetchWeatherByDate(_date: Date): Promise<WeatherData | null> {
    return null;
  }
}

// Use real provider; falls back gracefully on error
// TODO: Override with WEATHER_PROVIDER=mock to force mock during tests
export const weatherProvider: WeatherProvider =
  process.env.WEATHER_PROVIDER === "mock"
    ? new MockWeatherProvider()
    : new OpenMeteoWeatherProvider();
