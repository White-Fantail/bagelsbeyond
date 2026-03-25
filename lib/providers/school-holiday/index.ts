export type SchoolHolidayData = {
  isHoliday: boolean;
  termName?: string; // e.g. "Term 1 Holiday", "Summer Holiday"
  region?: string;   // e.g. "Auckland", "National"
};

export interface SchoolHolidayProvider {
  fetchSchoolHolidayByDate(date: Date): Promise<SchoolHolidayData | null>;
}

// TODO: Replace with real NZ school holiday data source
// Options: Ministry of Education calendar, scraped data, or a maintained database table
// Set SCHOOL_HOLIDAY_API_KEY in .env if needed

export class MockSchoolHolidayProvider implements SchoolHolidayProvider {
  // Approximate NZ school holiday periods (month is 0-indexed)
  private static isInRange(date: Date, start: [number, number], end: [number, number]): boolean {
    const month = date.getMonth();
    const day = date.getDate();
    const afterStart = month > start[0] || (month === start[0] && day >= start[1]);
    const beforeEnd = month < end[0] || (month === end[0] && day <= end[1]);
    return afterStart && beforeEnd;
  }

  async fetchSchoolHolidayByDate(date: Date): Promise<SchoolHolidayData | null> {
    // Approximate NZ school holiday periods (using 0-based months)
    const periods: { start: [number, number]; end: [number, number]; name: string }[] = [
      { start: [0, 20], end: [1, 2], name: "Summer Holiday" },     // Jan 20 – Feb 2
      { start: [3, 13], end: [4, 27], name: "Term 1 Holiday" },   // Apr 13 – Apr 27 (approx)
      { start: [6, 6], end: [7, 20], name: "Term 2 Holiday" },    // Jul 6 – Jul 20 (approx)
      { start: [9, 26], end: [10, 6], name: "Term 3 Holiday" },   // Sep 26 – Oct 6 (approx)
      { start: [11, 20], end: [11, 31], name: "Summer Holiday" }, // Dec 20 – Dec 31
    ];

    for (const period of periods) {
      if (MockSchoolHolidayProvider.isInRange(date, period.start, period.end)) {
        return { isHoliday: true, termName: period.name, region: "NZ National" };
      }
    }

    return { isHoliday: false };
  }
}

export const schoolHolidayProvider: SchoolHolidayProvider = new MockSchoolHolidayProvider();
