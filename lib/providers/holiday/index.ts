export type HolidayData = {
  name: string;
  isPublicHoliday: boolean;
};

export interface HolidayProvider {
  fetchHolidayByDate(date: Date): Promise<HolidayData | null>;
}

// TODO: Replace with real NZ public holiday API (e.g. https://date.nager.at/api/v3/PublicHolidays)
// Set HOLIDAY_API_KEY in .env if needed
export class MockHolidayProvider implements HolidayProvider {
  // Known NZ public holidays (simplified static list)
  private static knownHolidays: Record<string, string> = {
    "01-01": "뉴이어 데이",
    "02-06": "와이탕이 데이",
    "04-25": "안작 데이",
    "12-25": "크리스마스",
    "12-26": "박싱 데이",
  };

  async fetchHolidayByDate(date: Date): Promise<HolidayData | null> {
    const key = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const name = MockHolidayProvider.knownHolidays[key];
    if (name) return { name, isPublicHoliday: true };
    return null;
  }
}

export const holidayProvider: HolidayProvider = new MockHolidayProvider();
