export type HolidayData = {
  name: string;
  isPublicHoliday: boolean;
};

export interface HolidayProvider {
  fetchHolidayByDate(date: Date, options?: HolidayProviderOptions): Promise<HolidayData | null>;
}

export type HolidayProviderOptions = {
  countryCode?: string;
};

// Nager.at public holiday API — free, no API key required
// Docs: https://date.nager.at/swagger/index.html
// TODO: Replace with a private API or data source if Nager.at is unavailable
export class NagerHolidayProvider implements HolidayProvider {
  private cache: Map<string, HolidayData | null> = new Map();

  async fetchHolidayByDate(
    date: Date,
    options: HolidayProviderOptions = {}
  ): Promise<HolidayData | null> {
    const countryCode = options.countryCode ?? process.env.DEFAULT_COUNTRY_CODE ?? "NZ";
    const year = date.getFullYear();
    const cacheKey = `${countryCode}:${year}`;

    if (!this.cache.has(cacheKey)) {
      await this.loadYear(countryCode, year);
    }

    const dateStr = date.toISOString().split("T")[0];
    return this.cache.get(`${cacheKey}:${dateStr}`) ?? null;
  }

  private async loadYear(countryCode: string, year: number): Promise<void> {
    const cacheKey = `${countryCode}:${year}`;
    try {
      const res = await fetch(
        `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`,
        { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) {
        this.cache.set(cacheKey, null);
        return;
      }
      const holidays = await res.json() as Array<{ date: string; name: string; localName: string }>;
      // Mark the year as loaded even if the list is empty
      this.cache.set(cacheKey, null);
      for (const h of holidays) {
        this.cache.set(`${cacheKey}:${h.date}`, {
          name: h.localName || h.name,
          isPublicHoliday: true,
        });
      }
    } catch {
      this.cache.set(cacheKey, null);
    }
  }
}

// Fallback mock with a small static list of NZ public holidays
export class MockHolidayProvider implements HolidayProvider {
  private static knownHolidays: Record<string, string> = {
    "01-01": "New Year's Day",
    "02-06": "Waitangi Day",
    "04-25": "Anzac Day",
    "12-25": "Christmas",
    "12-26": "Boxing Day",
  };

  async fetchHolidayByDate(date: Date): Promise<HolidayData | null> {
    const key = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const name = MockHolidayProvider.knownHolidays[key];
    if (name) return { name, isPublicHoliday: true };
    return null;
  }
}

// Use real Nager.at provider by default; override with HOLIDAY_PROVIDER=mock for tests
// TODO: Set HOLIDAY_API_KEY in .env if a future paid provider requires authentication
export const holidayProvider: HolidayProvider =
  process.env.HOLIDAY_PROVIDER === "mock"
    ? new MockHolidayProvider()
    : new NagerHolidayProvider();
