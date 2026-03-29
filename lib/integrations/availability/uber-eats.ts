// ─── Bagel Availability: Uber Eats Adapter ────────────────────────────────────
// Pushes bagel availability state to Uber Eats.
//
// Strategy:
//  - Uses the Uber Eats Order Ingestion API (item status update) if remoteStoreId + remoteEntityId are set.
//  - If the store is not configured for sparse item updates, marks sync as failed with a clear error.
//  - Full menu upload fallback can be added later; not implemented here.
//
// Environment variables:
//   UBER_EATS_CLIENT_ID     — OAuth client ID
//   UBER_EATS_CLIENT_SECRET — OAuth client secret
//   UBER_EATS_API_BASE_URL  — Override base URL

import type { AvailabilityAdapter, ChannelMapping, SyncOutcome } from "./base";

const DEFAULT_BASE_URL = "https://api.uber.com";

function getBaseUrl(): string {
  return process.env.UBER_EATS_API_BASE_URL ?? DEFAULT_BASE_URL;
}

function isConfigured(): boolean {
  return !!(process.env.UBER_EATS_CLIENT_ID && process.env.UBER_EATS_CLIENT_SECRET);
}

let _cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  if (_cachedToken && Date.now() < _cachedToken.expiresAt) {
    return _cachedToken.token;
  }

  try {
    const res = await fetch(`${getBaseUrl()}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.UBER_EATS_CLIENT_ID ?? "",
        client_secret: process.env.UBER_EATS_CLIENT_SECRET ?? "",
        grant_type: "client_credentials",
        scope: "eats.store.menu.update",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token: string; expires_in: number };
    _cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000 - 30_000,
    };
    return _cachedToken.token;
  } catch {
    return null;
  }
}

export const uberEatsAvailabilityAdapter: AvailabilityAdapter = {
  channel: "uber_eats",

  async pushAvailability(
    _bagelTypeCode: string,
    isAvailable: boolean,
    mappings: ChannelMapping[]
  ): Promise<SyncOutcome> {
    const enabledMappings = mappings.filter((m) => m.isEnabled);

    if (enabledMappings.length === 0) {
      return { status: "skipped", reason: "No enabled Uber Eats mappings for this bagel type" };
    }

    if (!isConfigured()) {
      return {
        status: "skipped",
        reason: "Uber Eats credentials not configured (UBER_EATS_CLIENT_ID / UBER_EATS_CLIENT_SECRET)",
      };
    }

    const token = await getAccessToken();
    if (!token) {
      return { status: "failed", error: "Could not obtain Uber Eats access token", retryable: true };
    }

    const errors: string[] = [];
    let successCount = 0;

    for (const mapping of enabledMappings) {
      const storeId = mapping.remoteStoreId;
      const itemId = mapping.remoteEntityId;
      const menuId = mapping.remoteMenuId;

      if (!storeId || !itemId) {
        errors.push(`Mapping ${mapping.id}: remoteStoreId and remoteEntityId required`);
        continue;
      }

      try {
        // Uber Eats item-level availability (sparse update)
        const url = menuId
          ? `${getBaseUrl()}/v2/eats/stores/${storeId}/menus/${menuId}/items/${itemId}`
          : `${getBaseUrl()}/v2/eats/stores/${storeId}/items/${itemId}`;

        const res = await fetch(url, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ available: isAvailable }),
        });

        if (res.ok) {
          successCount++;
        } else {
          const body = await res.text().catch(() => "");
          if (res.status === 404) {
            errors.push(
              `Mapping ${mapping.id}: Item not found on Uber Eats (${res.status}). ` +
              `Ensure the menu has been initialized and item ID is correct.`
            );
          } else if (res.status === 403) {
            errors.push(
              `Mapping ${mapping.id}: Access denied (${res.status}). ` +
              `This store/account may not have item-level update access.`
            );
          } else {
            errors.push(`Mapping ${mapping.id}: HTTP ${res.status}: ${body.slice(0, 200)}`);
          }
        }
      } catch (err) {
        errors.push(`Mapping ${mapping.id}: ${String(err)}`);
      }
    }

    if (successCount === enabledMappings.length && errors.length === 0) {
      return { status: "success", remoteState: isAvailable };
    }
    if (successCount === 0) {
      return { status: "failed", error: errors.join("; "), retryable: true };
    }
    return { status: "partial", successCount, failureCount: errors.length, errors };
  },
};
