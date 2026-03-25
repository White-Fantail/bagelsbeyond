export type LocalEventData = {
  name: string;
  description?: string;
};

export interface EventsProvider {
  fetchLocalEventsByDate(date: Date): Promise<LocalEventData[]>;
}

// TODO: Replace with real local events API or manual event database
// Consider using a local database table for manually entered events
export class MockEventsProvider implements EventsProvider {
  async fetchLocalEventsByDate(_date: Date): Promise<LocalEventData[]> {
    // Fallback mock - returns empty array (no known events)
    return [];
  }
}

export const eventsProvider: EventsProvider = new MockEventsProvider();
