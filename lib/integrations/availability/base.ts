// ─── Bagel Availability Integration: Base Types ───────────────────────────────
// Provider-based integration structure for pushing bagel availability changes
// to external channels (Loyverse, Uber Eats, DoorDash).

export type AvailabilityChannel = "loyverse" | "uber_eats" | "doordash";

export type SyncOutcome =
  | { status: "success"; remoteState?: boolean }
  | { status: "failed"; error: string; retryable: boolean }
  | { status: "skipped"; reason: string }
  | { status: "partial"; successCount: number; failureCount: number; errors: string[] };

export interface ChannelMapping {
  id: string;
  bagelTypeId: string;
  channel: AvailabilityChannel;
  remoteEntityType: string;
  remoteEntityId: string;
  remoteMenuId: string | null;
  remoteStoreId: string | null;
  metadata: Record<string, unknown> | null;
  isEnabled: boolean;
}

export interface AvailabilityAdapter {
  readonly channel: AvailabilityChannel;
  /**
   * Push the desired availability state for a bagel type to the remote platform.
   * Must not throw — return a SyncOutcome instead.
   */
  pushAvailability(
    bagelTypeCode: string,
    isAvailable: boolean,
    mappings: ChannelMapping[]
  ): Promise<SyncOutcome>;
}
