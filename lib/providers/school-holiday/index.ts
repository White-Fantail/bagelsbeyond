export type SchoolHolidayData = {
  isHoliday: boolean;
  termName?: string;  // e.g. "Term 1 Holiday", "Summer Holiday"
  region?: string;    // e.g. "Canterbury", "National"
};

export interface SchoolHolidayProvider {
  fetchSchoolHolidayByDate(date: Date, options?: SchoolHolidayOptions): Promise<SchoolHolidayData | null>;
}

export type SchoolHolidayOptions = {
  region?: string;
};

// NZ school term dates — approximate national schedule
// Source: Ministry of Education NZ — https://www.education.govt.nz/school/running-a-school/school-operations/school-term-and-holiday-dates/
// TODO: Replace or supplement with a live data source (e.g. MOE API or scraped dataset) for precision
// These dates are illustrative for 2024/2025; update annually or connect to a live source
type TermPeriod = { year: number; termName: string; start: string; end: string };

const NZ_SCHOOL_TERM_DATES: TermPeriod[] = [
  // 2024
  { year: 2024, termName: "Term 1",          start: "2024-01-29", end: "2024-04-12" },
  { year: 2024, termName: "Term 2",          start: "2024-04-29", end: "2024-06-28" },
  { year: 2024, termName: "Term 3",          start: "2024-07-15", end: "2024-09-20" },
  { year: 2024, termName: "Term 4",          start: "2024-10-07", end: "2024-12-20" },
  // 2025
  { year: 2025, termName: "Term 1",          start: "2025-01-28", end: "2025-04-11" },
  { year: 2025, termName: "Term 2",          start: "2025-04-28", end: "2025-06-27" },
  { year: 2025, termName: "Term 3",          start: "2025-07-14", end: "2025-09-19" },
  { year: 2025, termName: "Term 4",          start: "2025-10-06", end: "2025-12-19" },
  // 2026 (approximate)
  { year: 2026, termName: "Term 1",          start: "2026-01-27", end: "2026-04-10" },
  { year: 2026, termName: "Term 2",          start: "2026-04-27", end: "2026-06-26" },
  { year: 2026, termName: "Term 3",          start: "2026-07-13", end: "2026-09-18" },
  { year: 2026, termName: "Term 4",          start: "2026-10-05", end: "2026-12-18" },
];

function isSummerHoliday(date: Date): boolean {
  const m = date.getMonth(); // 0-indexed
  const d = date.getDate();
  // Approximate NZ summer school holiday: Dec 20 – Jan 27
  if (m === 11 && d >= 20) return true;
  if (m === 0 && d <= 27) return true;
  return false;
}

function getTermHolidayName(date: Date): string | null {
  const year = date.getFullYear();
  const dateMs = date.getTime();

  // Check if date is BETWEEN terms (school holiday period)
  const termsForYear = NZ_SCHOOL_TERM_DATES.filter((t) => t.year === year);
  for (let i = 0; i < termsForYear.length - 1; i++) {
    const endOfTerm = new Date(termsForYear[i].end + "T00:00:00");
    const startOfNext = new Date(termsForYear[i + 1].start + "T00:00:00");
    if (dateMs > endOfTerm.getTime() && dateMs < startOfNext.getTime()) {
      return `${termsForYear[i].termName} Holiday`;
    }
  }
  return null;
}

export class RuleBasedSchoolHolidayProvider implements SchoolHolidayProvider {
  async fetchSchoolHolidayByDate(
    date: Date,
    options: SchoolHolidayOptions = {}
  ): Promise<SchoolHolidayData> {
    const region = options.region ?? process.env.DEFAULT_REGION ?? "Canterbury";

    if (isSummerHoliday(date)) {
      return { isHoliday: true, termName: "Summer Holiday", region };
    }

    const termHoliday = getTermHolidayName(date);
    if (termHoliday) {
      return { isHoliday: true, termName: termHoliday, region };
    }

    return { isHoliday: false, region };
  }
}

// Fallback mock (same as rule-based but named for clarity)
export class MockSchoolHolidayProvider implements SchoolHolidayProvider {
  async fetchSchoolHolidayByDate(date: Date): Promise<SchoolHolidayData | null> {
    return new RuleBasedSchoolHolidayProvider().fetchSchoolHolidayByDate(date);
  }
}

// TODO: Set SCHOOL_HOLIDAY_API_KEY in .env if a live data source requires authentication
export const schoolHolidayProvider: SchoolHolidayProvider =
  process.env.SCHOOL_HOLIDAY_PROVIDER === "mock"
    ? new MockSchoolHolidayProvider()
    : new RuleBasedSchoolHolidayProvider();
