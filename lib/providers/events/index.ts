export type LocalEventData = {
  name: string;
  description?: string;
};

export interface EventsProvider {
  fetchLocalEventsByDate(date: Date, options?: EventsProviderOptions): Promise<LocalEventData[]>;
}

export type EventsProviderOptions = {
  region?: string;
};

// TODO: Connect to a real events data source.
// Options:
//   - A local database table (e.g. manually curated events)
//   - Eventfinda API (NZ events — requires API key: set EVENTFINDA_API_KEY in .env)
//   - iTicket / Ticketek scrape (terms-dependent)
//   - Canterbury/Christchurch City Council events feed
// For now this returns an empty list (no known events = no adjustment to predictions).
export class PlaceholderEventsProvider implements EventsProvider {
  async fetchLocalEventsByDate(
    _date: Date,
    _options: EventsProviderOptions = {}
  ): Promise<LocalEventData[]> {
    // TODO: Implement real event lookup when a reliable free/low-cost source is available
    // Example shape: [{ name: "Addington Night Market", description: "Weekly market" }]
    return [];
  }
}

// Fallback mock — same as placeholder; kept distinct for test override
export class MockEventsProvider implements EventsProvider {
  async fetchLocalEventsByDate(_date: Date): Promise<LocalEventData[]> {
    return [];
  }
}

// TODO: Set EVENTS_PROVIDER=mock in .env to force mock during tests
export const eventsProvider: EventsProvider =
  process.env.EVENTS_PROVIDER === "mock"
    ? new MockEventsProvider()
    : new PlaceholderEventsProvider();
