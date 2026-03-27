import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenMeteoWeatherProvider } from "../providers/weather/index";

// ─── URL encoding fix verification ──────────────────────────────────────────

// Minimal fake response that satisfies what the provider needs
function makeFetchStub(overrides?: Partial<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }>) {
  const defaults = {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        daily: {
          temperature_2m_max: [18.5],
          temperature_2m_min: [10.2],
          precipitation_sum: [0.0],
          windspeed_10m_max: [25.0],
          weathercode: [1],
        },
      }),
    text: () => Promise.resolve(""),
  };
  const mock = { ...defaults, ...overrides };
  return vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
    Promise.resolve(mock as unknown as Response)
  );
}

describe("OpenMeteoWeatherProvider — timezone URL encoding", () => {
  let capturedUrl: string | null = null;

  beforeEach(() => {
    capturedUrl = null;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => {
        capturedUrl = String(_input);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              daily: {
                temperature_2m_max: [18.5],
                temperature_2m_min: [10.2],
                precipitation_sum: [0.0],
                windspeed_10m_max: [25.0],
                weathercode: [1],
              },
            }),
        } as unknown as Response);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does NOT double-encode the timezone (Pacific/Auckland must appear as %2F, not %252F)", async () => {
    const provider = new OpenMeteoWeatherProvider();
    const date = new Date("2025-01-15T00:00:00.000Z");
    await provider.fetchWeatherByDate(date, { timezone: "Pacific/Auckland" });

    expect(capturedUrl).not.toBeNull();
    // URLSearchParams encodes "/" to "%2F" — this is correct single-encoding
    expect(capturedUrl).toContain("timezone=Pacific%2FAuckland");
    // Double-encoding would produce %252F — this must NOT be present
    expect(capturedUrl).not.toContain("timezone=Pacific%252FAuckland");
  });

  it("uses archive endpoint for past dates", async () => {
    const provider = new OpenMeteoWeatherProvider();
    const pastDate = new Date("2024-06-01T00:00:00.000Z");
    await provider.fetchWeatherByDate(pastDate);

    expect(capturedUrl).toContain("archive-api.open-meteo.com");
  });

  it("uses forecast endpoint for today or future dates", async () => {
    const provider = new OpenMeteoWeatherProvider();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    await provider.fetchWeatherByDate(tomorrow);

    expect(capturedUrl).toContain("api.open-meteo.com/v1/forecast");
  });

  it("returns correct mapped WeatherData fields", async () => {
    const provider = new OpenMeteoWeatherProvider();
    const date = new Date("2025-01-15T00:00:00.000Z");
    const result = await provider.fetchWeatherByDate(date);

    expect(result).not.toBeNull();
    expect(result!.summary).toBe("Partly Cloudy"); // WMO code 1
    expect(result!.maxTemp).toBe(18.5);
    expect(result!.minTemp).toBe(10.2);
    expect(result!.rainMm).toBe(0);
    expect(result!.windKph).toBe(25);
  });

  it("throws (does not return null) when API responds with an error status", async () => {
    vi.stubGlobal("fetch", makeFetchStub({
      ok: false,
      status: 400,
      text: () => Promise.resolve('{"reason":"Invalid timezone"}'),
    }));
    const provider = new OpenMeteoWeatherProvider();
    const date = new Date("2025-01-15T00:00:00.000Z");
    await expect(provider.fetchWeatherByDate(date)).rejects.toThrow("Weather API 400");
  });

  it("returns null (not throw) when daily data is absent", async () => {
    vi.stubGlobal("fetch", makeFetchStub({
      json: () => Promise.resolve({}), // no 'daily' key
    }));
    const provider = new OpenMeteoWeatherProvider();
    const date = new Date("2025-01-15T00:00:00.000Z");
    const result = await provider.fetchWeatherByDate(date);
    expect(result).toBeNull();
  });
});
