// ─── Bagel Availability: Loyverse Adapter ─────────────────────────────────────
// Pushes bagel availability state to the Loyverse POS system.
//
// Strategy:
//  - For "item" or "option": Update inventory level as a proxy for availability
//    (Loyverse does not have a first-class "hide item" API).
//    Set to 0 for OFF, large number for ON.
//  - For "modifier_option": Loyverse has no direct option disable — mark as skipped.
//  - Falls back to skipped with a clear reason if entity type is unsupported.
//
// Environment variables:
//   LOYVERSE_API_TOKEN    — Bearer token
//   LOYVERSE_API_BASE_URL — Override base URL (default: https://api.loyverse.com/v1.0)
//   LOYVERSE_MOCK=true    — Use mock mode

import type { AvailabilityAdapter, ChannelMapping, SyncOutcome } from "./base";

const DEFAULT_BASE_URL = "https://api.loyverse.com/v1.0";

function getToken(): string | undefined {
  return process.env.LOYVERSE_API_TOKEN;
}

function getBaseUrl(): string {
  return process.env.LOYVERSE_API_BASE_URL ?? DEFAULT_BASE_URL;
}

function isMock(): boolean {
  return process.env.LOYVERSE_MOCK === "true" || !getToken();
}

async function setVariantInventory(
  variantId: string,
  storeId: string,
  inStock: number
): Promise<{ ok: boolean; error?: string }> {
  const token = getToken();
  const baseUrl = getBaseUrl();

  try {
    const res = await fetch(`${baseUrl}/inventory`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inventory_levels: [
          { variant_id: variantId, store_id: storeId, in_stock: inStock },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export const loyverseAvailabilityAdapter: AvailabilityAdapter = {
  channel: "loyverse",

  async pushAvailability(
    _bagelTypeCode: string,
    isAvailable: boolean,
    mappings: ChannelMapping[]
  ): Promise<SyncOutcome> {
    const enabledMappings = mappings.filter((m) => m.isEnabled);

    if (enabledMappings.length === 0) {
      return { status: "skipped", reason: "No enabled Loyverse mappings for this bagel type" };
    }

    if (isMock()) {
      console.log(
        `[Loyverse Availability Mock] Would set ${_bagelTypeCode} to ${isAvailable ? "ON" : "OFF"} for ${enabledMappings.length} mapping(s)`
      );
      return { status: "success", remoteState: isAvailable };
    }

    const errors: string[] = [];
    let successCount = 0;

    for (const mapping of enabledMappings) {
      const entityType = mapping.remoteEntityType;

      if (entityType === "item" || entityType === "option") {
        // Use inventory level as availability proxy
        const storeId = mapping.remoteStoreId;
        if (!storeId) {
          errors.push(`Mapping ${mapping.id}: remoteStoreId required for inventory update`);
          continue;
        }
        const inStock = isAvailable ? 999 : 0;
        const result = await setVariantInventory(mapping.remoteEntityId, storeId, inStock);
        if (result.ok) {
          successCount++;
        } else {
          errors.push(`Mapping ${mapping.id}: ${result.error}`);
        }
      } else if (entityType === "modifier_option") {
        errors.push(
          `Mapping ${mapping.id}: Loyverse does not support direct modifier option hide/show. Mark as skipped.`
        );
      } else {
        errors.push(
          `Mapping ${mapping.id}: Unsupported entity type "${entityType}" — skipped`
        );
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
