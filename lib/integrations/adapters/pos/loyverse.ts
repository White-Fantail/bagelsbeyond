// ─── Loyverse POS Adapter ─────────────────────────────────────────────────────
// Loyverse API v1.0 adapter.
// Docs: https://developer.loyverse.com/docs/
//
// Configure via environment variables:
//   LOYVERSE_API_TOKEN   — Bearer token from Loyverse back office
//   LOYVERSE_API_BASE_URL — Override base URL (defaults to https://api.loyverse.com/v1.0)
//   POS_PROVIDER         — Set to "LOYVERSE" (used by factory helpers)
//   LOYVERSE_MOCK=true   — Use mock data instead of real API (dev / CI)
//
// To add another POS, create a new file (e.g. square.ts) that implements the
// same POSAdapter interface.

import type {
  POSAdapter,
  ExternalProduct,
  ExternalOrder,
  SyncResult,
  LoyverseRawItem,
  LoyverseRawCategory,
  LoyverseRawModifierGroup,
  LoyverseCatalogRaw,
} from "./types";
import { normalizeLoyverseCatalog } from "../../services/catalog-mapper";

const DEFAULT_BASE_URL = "https://api.loyverse.com/v1.0";

// ─── Error helpers ────────────────────────────────────────────────────────────

class LoyverseApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "LoyverseApiError";
  }
}

// ─── Mock data (used when LOYVERSE_MOCK=true or token absent) ─────────────────

const MOCK_CATALOG: LoyverseCatalogRaw = {
  items: [
    {
      id: "mock-item-001",
      item_name: "Classic Bagel",
      description: "Plain bagel, freshly baked daily",
      reference_id: "SKU-BAGEL-001",
      category_id: "mock-cat-001",
      sold_by_weight: false,
      is_composite: false,
      modifiers_ids: ["mock-mod-group-001"],
      form: "FORM_ITEM",
      image_url: null,
      color: null,
      variants: [
        {
          variant_id: "mock-var-001",
          item_id: "mock-item-001",
          sku: "SKU-BAGEL-001",
          reference_id: "REF-001",
          barcode: null,
          cost: 1.5,
          default_pricing_type: "FIXED",
          default_price: 4.5,
          stores: [
            {
              store_id: "mock-store-001",
              pricing_type: "FIXED",
              price: 4.5,
              available_for_sale: true,
            },
          ],
          option1_name: null,
          option1_val: null,
          option2_name: null,
          option2_val: null,
          option3_name: null,
          option3_val: null,
        },
      ],
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-06-01T00:00:00.000Z",
      deleted_at: null,
    },
    {
      id: "mock-item-002",
      item_name: "Cream Cheese Bagel",
      description: "Bagel with house-made cream cheese",
      reference_id: "SKU-BAGEL-002",
      category_id: "mock-cat-001",
      sold_by_weight: false,
      is_composite: false,
      modifiers_ids: [],
      form: "FORM_ITEM",
      image_url: null,
      color: null,
      variants: [
        {
          variant_id: "mock-var-002",
          item_id: "mock-item-002",
          sku: "SKU-BAGEL-002",
          reference_id: null,
          barcode: null,
          cost: 1.8,
          default_pricing_type: "FIXED",
          default_price: 6.5,
          stores: [
            {
              store_id: "mock-store-001",
              pricing_type: "FIXED",
              price: 6.5,
              available_for_sale: true,
            },
          ],
          option1_name: null,
          option1_val: null,
          option2_name: null,
          option2_val: null,
          option3_name: null,
          option3_val: null,
        },
      ],
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-06-01T00:00:00.000Z",
      deleted_at: null,
    },
    {
      id: "mock-item-003",
      item_name: "Flat White",
      description: "Double espresso with steamed milk",
      reference_id: null,
      category_id: "mock-cat-002",
      sold_by_weight: false,
      is_composite: false,
      modifiers_ids: ["mock-mod-group-002"],
      form: "FORM_ITEM",
      image_url: null,
      color: null,
      variants: [
        {
          variant_id: "mock-var-003",
          item_id: "mock-item-003",
          sku: null,
          reference_id: null,
          barcode: null,
          cost: 0.5,
          default_pricing_type: "FIXED",
          default_price: 5.0,
          stores: [
            {
              store_id: "mock-store-001",
              pricing_type: "FIXED",
              price: 5.0,
              available_for_sale: true,
            },
          ],
          option1_name: null,
          option1_val: null,
          option2_name: null,
          option2_val: null,
          option3_name: null,
          option3_val: null,
        },
      ],
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-06-01T00:00:00.000Z",
      deleted_at: null,
    },
  ],
  categories: [
    { id: "mock-cat-001", name: "Bagels", color: null, deleted_at: null },
    { id: "mock-cat-002", name: "Drinks", color: null, deleted_at: null },
  ],
  modifierGroups: [
    {
      id: "mock-mod-group-001",
      name: "Toppings",
      modifiers: [
        { id: "mock-mod-001", name: "Extra Cream Cheese", price: 1.0 },
        { id: "mock-mod-002", name: "Avocado", price: 2.0 },
        { id: "mock-mod-003", name: "Smoked Salmon", price: 3.5 },
      ],
    },
    {
      id: "mock-mod-group-002",
      name: "Milk Choice",
      modifiers: [
        { id: "mock-mod-004", name: "Regular Milk", price: 0 },
        { id: "mock-mod-005", name: "Oat Milk", price: 0.8 },
        { id: "mock-mod-006", name: "Soy Milk", price: 0.5 },
      ],
    },
  ],
};

// ─── Loyverse Adapter ─────────────────────────────────────────────────────────

export class LoyverseAdapter implements POSAdapter {
  private readonly apiToken: string;
  private readonly baseUrl: string;
  private readonly mockMode: boolean;

  constructor(apiToken: string, baseUrl?: string) {
    this.apiToken = apiToken;
    this.baseUrl = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.mockMode = process.env.LOYVERSE_MOCK === "true" || !apiToken;
  }

  private get authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Low-level fetch wrapper with auth header and unified error handling.
   * Handles 401, 429, 5xx with descriptive errors.
   */
  private async fetchWithAuth<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    console.debug(`[Loyverse] GET ${url}`);

    let res: Response;
    try {
      res = await fetch(url, { headers: this.authHeaders });
    } catch (err) {
      throw new LoyverseApiError(
        `Network error calling Loyverse (${path}): ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (res.status === 401) {
      throw new LoyverseApiError(
        "Loyverse authentication failed — check LOYVERSE_API_TOKEN",
        401
      );
    }
    if (res.status === 429) {
      throw new LoyverseApiError(
        "Loyverse rate limit exceeded (HTTP 429) — retry later",
        429
      );
    }
    if (res.status >= 500) {
      throw new LoyverseApiError(
        `Loyverse server error (HTTP ${res.status}) — try again later`,
        res.status
      );
    }
    if (!res.ok) {
      throw new LoyverseApiError(
        `Loyverse API error (HTTP ${res.status}) on ${path}`,
        res.status
      );
    }

    return res.json() as Promise<T>;
  }

  /**
   * Fetch all items (products) from Loyverse, following cursor-based pagination.
   */
  async fetchItems(): Promise<LoyverseRawItem[]> {
    if (this.mockMode) {
      console.info("[Loyverse] Mock mode — returning mock items");
      return MOCK_CATALOG.items;
    }

    const allItems: LoyverseRawItem[] = [];
    let cursor: string | null = null;

    do {
      const query: string = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const page: { items: LoyverseRawItem[]; cursor: string | null } =
        await this.fetchWithAuth<{
          items: LoyverseRawItem[];
          cursor: string | null;
        }>(`/items${query}`);

      if (Array.isArray(page.items)) {
        allItems.push(...page.items);
      }
      cursor = page.cursor ?? null;
    } while (cursor);

    console.info(`[Loyverse] Fetched ${allItems.length} items`);
    return allItems;
  }

  /**
   * Fetch all categories from Loyverse.
   */
  async fetchCategories(): Promise<LoyverseRawCategory[]> {
    if (this.mockMode) {
      return MOCK_CATALOG.categories;
    }

    const data = await this.fetchWithAuth<{ categories: LoyverseRawCategory[] }>(
      "/categories"
    );
    const categories = Array.isArray(data.categories) ? data.categories : [];
    console.info(`[Loyverse] Fetched ${categories.length} categories`);
    return categories;
  }

  /**
   * Fetch all modifier groups from Loyverse.
   * Each group contains its modifiers inline.
   */
  async fetchModifierGroups(): Promise<LoyverseRawModifierGroup[]> {
    if (this.mockMode) {
      return MOCK_CATALOG.modifierGroups;
    }

    const data = await this.fetchWithAuth<{
      modifier_groups: LoyverseRawModifierGroup[];
    }>("/modifier_groups");
    const groups = Array.isArray(data.modifier_groups) ? data.modifier_groups : [];
    console.info(`[Loyverse] Fetched ${groups.length} modifier groups`);
    return groups;
  }

  /**
   * Fetch the full raw catalogue (items + categories + modifier groups) in one call.
   */
  async fetchCatalog(): Promise<LoyverseCatalogRaw> {
    const [items, categories, modifierGroups] = await Promise.all([
      this.fetchItems(),
      this.fetchCategories(),
      this.fetchModifierGroups(),
    ]);
    return { items, categories, modifierGroups };
  }

  /**
   * Normalise raw Loyverse catalogue into the POS-agnostic ExternalProduct[].
   * Uses the catalog-mapper for field-level translation.
   */
  normalizeCatalog(raw: LoyverseCatalogRaw): ExternalProduct[] {
    return normalizeLoyverseCatalog(raw);
  }

  // ─── POSAdapter interface implementation ───────────────────────────────────

  /**
   * Fetch and normalise the full catalogue for internal sync use.
   */
  async fetchExternalCatalog(): Promise<SyncResult<ExternalProduct[]>> {
    try {
      const raw = await this.fetchCatalog();
      const products = this.normalizeCatalog(raw);
      console.info(`[Loyverse] Normalised ${products.length} products`);
      return { success: true, data: products };
    } catch (err) {
      const message =
        err instanceof LoyverseApiError
          ? err.message
          : `Unexpected error: ${String(err)}`;
      console.error("[Loyverse] fetchExternalCatalog failed:", message);
      return { success: false, error: message };
    }
  }

  /**
   * Push an order to Loyverse.
   * TODO: Implement real API call to POST /receipts
   */
  async pushOrderToExternalPos(
    order: ExternalOrder
  ): Promise<SyncResult<{ externalOrderId: string }>> {
    if (!this.apiToken) {
      return { success: false, error: "LOYVERSE_API_TOKEN is not configured" };
    }

    // TODO: Replace with real Loyverse receipt push:
    // const payload = mapInternalOrderToLoyverse(order);
    // const res = await this.fetchWithAuth<{ receipt_number: string }>(
    //   "/receipts", { method: "POST", body: JSON.stringify(payload) }
    // );
    // return { success: true, data: { externalOrderId: res.receipt_number } };

    void order;
    return {
      success: false,
      error: "pushOrderToExternalPos not yet implemented",
    };
  }

  /**
   * Sync daily sold quantities from Loyverse receipts.
   * TODO: Implement real API call to GET /receipts with date range filter
   */
  async syncInventoryFromExternal(
    date: Date
  ): Promise<SyncResult<Record<string, number>>> {
    if (!this.apiToken) {
      return { success: false, error: "LOYVERSE_API_TOKEN is not configured" };
    }

    // TODO: Replace with real Loyverse receipts query:
    // const start = new Date(date); start.setHours(0,0,0,0);
    // const end   = new Date(date); end.setHours(23,59,59,999);
    // const res = await this.fetchWithAuth<{ receipts: unknown[] }>(
    //   `/receipts?created_at_min=${start.toISOString()}&created_at_max=${end.toISOString()}`
    // );
    // return { success: true, data: aggregateSoldQty(res.receipts) };

    void date;
    return {
      success: false,
      error: "syncInventoryFromExternal not yet implemented",
    };
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create a LoyverseAdapter from environment variables. */
export function createLoyverseAdapter(): LoyverseAdapter {
  const token = process.env.LOYVERSE_API_TOKEN ?? "";
  const baseUrl = process.env.LOYVERSE_API_BASE_URL ?? DEFAULT_BASE_URL;
  return new LoyverseAdapter(token, baseUrl);
}

/** Returns true if Loyverse is the active POS provider */
export function isLoyverseEnabled(): boolean {
  return (
    process.env.POS_PROVIDER === "LOYVERSE" ||
    Boolean(process.env.LOYVERSE_API_TOKEN)
  );
}

/** Returns true when running in mock/dev mode (no real API key required) */
export function isLoyverseMockMode(): boolean {
  return (
    process.env.LOYVERSE_MOCK === "true" || !process.env.LOYVERSE_API_TOKEN
  );
}
