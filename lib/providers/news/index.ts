export type NewsSummaryData = {
  nzSummary?: string;
  worldSummary?: string;
  sentimentScore?: number; // -1 to 1, negative = bad news
};

export interface NewsProvider {
  fetchNewsSummaryByDate(date: Date): Promise<NewsSummaryData | null>;
}

// TODO: Replace with real news API (e.g. NewsAPI, GNews)
// Set NEWS_API_KEY in .env and implement RealNewsProvider
export class MockNewsProvider implements NewsProvider {
  async fetchNewsSummaryByDate(_date: Date): Promise<NewsSummaryData | null> {
    // Fallback mock - returns null to indicate no news data
    return null;
  }
}

export const newsProvider: NewsProvider = new MockNewsProvider();
