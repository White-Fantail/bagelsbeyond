// ─── Loyverse POS Adapter ─────────────────────────────────────────────────────
// Placeholder implementation for Loyverse POS integration.
// Replace the TODO sections with real Loyverse API calls when the API key is
// available (LOYVERSE_API_KEY env variable).
//
// Loyverse API docs: https://developer.loyverse.com/docs/
//
// To add support for another POS, create a new file (e.g. square.ts) that
// implements the same POSAdapter interface.

import type {
  POSAdapter,
  ExternalProduct,
  ExternalOrder,
  SyncResult,
} from "./types";

const BASE_URL = "https://api.loyverse.com/v1.0";

export class LoyverseAdapter implements POSAdapter {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Fetch all items (products) from the Loyverse catalogue.
   * TODO: Implement real API call to GET /items
   */
  async fetchExternalCatalog(): Promise<SyncResult<ExternalProduct[]>> {
    if (!this.apiKey) {
      return { success: false, error: "LOYVERSE_API_KEY is not configured" };
    }

    // TODO: Replace with real Loyverse API call:
    // const res = await fetch(`${BASE_URL}/items`, { headers: this.headers });
    // const data = await res.json();
    // return { success: true, data: data.items.map(mapLoyverseItem) };

    void BASE_URL; // referenced to avoid lint warning until real call is added
    void this.headers;

    return {
      success: false,
      error: "fetchExternalCatalog not yet implemented — add LOYVERSE_API_KEY and uncomment the fetch call",
    };
  }

  /**
   * Push an order to Loyverse.
   * TODO: Implement real API call to POST /receipts
   */
  async pushOrderToExternalPos(
    order: ExternalOrder
  ): Promise<SyncResult<{ externalOrderId: string }>> {
    if (!this.apiKey) {
      return { success: false, error: "LOYVERSE_API_KEY is not configured" };
    }

    // TODO: Replace with real Loyverse receipt push:
    // const payload = mapInternalOrderToLoyverse(order);
    // const res = await fetch(`${BASE_URL}/receipts`, { method: "POST", headers: this.headers, body: JSON.stringify(payload) });
    // const data = await res.json();
    // return { success: true, data: { externalOrderId: data.receipt_number } };

    void order;
    return {
      success: false,
      error: "pushOrderToExternalPos not yet implemented",
    };
  }

  /**
   * Sync daily sold quantities from Loyverse receipts.
   * TODO: Implement real API call to GET /receipts?created_at_min=...
   */
  async syncInventoryFromExternal(
    date: Date
  ): Promise<SyncResult<Record<string, number>>> {
    if (!this.apiKey) {
      return { success: false, error: "LOYVERSE_API_KEY is not configured" };
    }

    // TODO: Replace with real Loyverse receipts query filtered by date:
    // const start = new Date(date); start.setHours(0,0,0,0);
    // const end   = new Date(date); end.setHours(23,59,59,999);
    // const res = await fetch(`${BASE_URL}/receipts?created_at_min=${start.toISOString()}&created_at_max=${end.toISOString()}`, { headers: this.headers });
    // const data = await res.json();
    // const soldByExternalId = aggregateSoldQty(data.receipts);
    // return { success: true, data: soldByExternalId };

    void date;
    return {
      success: false,
      error: "syncInventoryFromExternal not yet implemented",
    };
  }
}

/** Factory: create the configured Loyverse adapter from env. */
export function createLoyverseAdapter(): LoyverseAdapter {
  const key = process.env.LOYVERSE_API_KEY ?? "";
  return new LoyverseAdapter(key);
}
