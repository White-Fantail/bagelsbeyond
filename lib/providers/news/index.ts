export type NewsSummaryData = {
  nzSummary?: string;
  worldSummary?: string;
  sentimentScore?: number; // -1 to 1, negative = bad news
};

export interface NewsProvider {
  fetchNewsSummaryByDate(date: Date): Promise<NewsSummaryData | null>;
}

// NewsAPI.org provider — requires API key
// Free tier: developer plan, historical up to 1 month
// Set NEWS_API_KEY in .env to enable
// Docs: https://newsapi.org/docs
// TODO: Replace with a more capable source (e.g. GDELT, GNews, Bing News) for deeper history
export class NewsApiProvider implements NewsProvider {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchNewsSummaryByDate(date: Date): Promise<NewsSummaryData | null> {
    const dateStr = date.toISOString().split("T")[0];
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().split("T")[0];

    try {
      const [nzRes, worldRes] = await Promise.all([
        this.fetchTopHeadlines("nz", dateStr, nextDayStr),
        this.fetchTopHeadlines("world", dateStr, nextDayStr),
      ]);

      if (!nzRes && !worldRes) return null;
      return { nzSummary: nzRes ?? undefined, worldSummary: worldRes ?? undefined };
    } catch {
      return null;
    }
  }

  private async fetchTopHeadlines(
    scope: "nz" | "world",
    from: string,
    to: string
  ): Promise<string | null> {
    const q = scope === "nz" ? "New Zealand" : "world news";
    const params = new URLSearchParams({
      q,
      from,
      to,
      sortBy: "popularity",
      pageSize: "3",
      apiKey: this.apiKey,
    });

    try {
      const res = await fetch(
        `https://newsapi.org/v2/everything?${params.toString()}`,
        { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) return null;

      const json = await res.json() as {
        articles?: Array<{ title?: string }>;
      };
      const titles = (json.articles ?? [])
        .slice(0, 3)
        .map((a) => a.title)
        .filter(Boolean)
        .join(" / ");
      return titles || null;
    } catch {
      return null;
    }
  }
}

// Fallback mock — returns null (no news data available without API key)
export class MockNewsProvider implements NewsProvider {
  async fetchNewsSummaryByDate(_date: Date): Promise<NewsSummaryData | null> {
    return null;
  }
}

// Use real NewsAPI if key is present, otherwise mock
// TODO: Set NEWS_API_KEY in .env to enable real news summaries
export const newsProvider: NewsProvider =
  process.env.NEWS_PROVIDER === "mock" || !process.env.NEWS_API_KEY
    ? new MockNewsProvider()
    : new NewsApiProvider(process.env.NEWS_API_KEY);
