// ─── Loyverse POS Adapter ─────────────────────────────────────────────────────
// Loyverse API v1.0 adapter.
// Docs: https://developer.loyverse.com/docs/
//
// Configure via environment variables:
//   LOYVERSE_API_TOKEN    — Bearer token from Loyverse back office
//   LOYVERSE_API_BASE_URL — Override base URL (defaults to https://api.loyverse.com/v1.0)
//   LOYVERSE_MOCK=true    — Use mock data instead of real API (dev / CI)
//
// This adapter only fetches raw data from Loyverse.
// It does NOT reference any internal canonical models.

import type {
  SyncResult,
  LoyverseRawItem,
  LoyverseRawCategory,
  LoyverseRawModifier,
  LoyverseRawVariant,
  LoyverseRawInventoryLevel,
  LoyverseCatalogRaw,
  LoyverseRawPaymentType,
  LoyverseRawReceipt,
} from "./types";

const DEFAULT_BASE_URL = "https://api.loyverse.com/v1.0";

const RAW_BODY_PREVIEW_LENGTH = 10_000;

// ─── Error helper ─────────────────────────────────────────────────────────────

class LoyverseApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "LoyverseApiError";
  }
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────

export interface ItemsFetchDiagnostics {
  loyverseMock: boolean;
  requestUrl: string | null;
  httpStatus: number | null;
  rawBodyContainsModifiersIds: boolean | null;
  rawBodyPreview: string | null;
  usingFallback: boolean;
  usingCache: boolean;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

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
      modifier_ids: ["mock-mod-group-001"],
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
          stores: [{ store_id: "mock-store-001", pricing_type: "FIXED", price: 4.5, available_for_sale: true }],
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
  modifiers: [
    {
      id: "mock-mod-group-001",
      name: "Spread Choice",
      min_select: 1,
      max_select: 1,
      required: true,
      options: [
        { id: "mock-opt-001", name: "Plain", price: 0 },
        { id: "mock-opt-002", name: "Cream Cheese", price: 1.5 },
      ],
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-06-01T00:00:00.000Z",
      deleted_at: null,
    },
  ],
};

const MOCK_PAYMENT_TYPES: LoyverseRawPaymentType[] = [
  {
    id: "mock-pt-001",
    name: "Cash",
    type: "CASH",
    stores: [{ store_id: "mock-store-001" }],
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "mock-pt-002",
    name: "Card",
    type: "CARD",
    stores: [{ store_id: "mock-store-001" }],
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
];

const MOCK_RECEIPTS: LoyverseRawReceipt[] = [
  {
    id: "mock-receipt-001",
    receipt_number: "R-001",
    store_id: "mock-store-001",
    customer_id: null,
    source: "SALE",
    receipt_date: "2024-06-01T10:00:00.000Z",
    note: null,
    line_items: [
      {
        variant_id: "mock-var-001",
        item_name: "Classic Bagel",
        quantity: 2,
        price: 4.5,
        cost: 1.5,
        note: null,
        modifiers: [],
      },
    ],
    payments: [
      {
        payment_type_id: "mock-pt-002",
        name: "Card",
        money_amount: 9.0,
        paid_at: "2024-06-01T10:01:00.000Z",
      },
    ],
  },
];

// ─── Adapter class ────────────────────────────────────────────────────────────

export class LoyverseAdapter {
  private readonly apiToken: string;
  private readonly baseUrl: string;
  private readonly mockMode: boolean;
  private _itemsDiagnostics: ItemsFetchDiagnostics | null = null;

  constructor(apiToken: string, baseUrl?: string) {
    this.apiToken = apiToken;
    this.baseUrl = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.mockMode = process.env.LOYVERSE_MOCK === "true" || !apiToken;
  }

  get itemsDiagnostics(): ItemsFetchDiagnostics | null {
    return this._itemsDiagnostics;
  }

  private get authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
    };
  }

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

    if (!res.ok) {
      let body = "";
      try { body = await res.text(); } catch { /* ignore */ }
      if (res.status === 401) throw new LoyverseApiError("Loyverse authentication failed — check LOYVERSE_API_TOKEN", 401);
      if (res.status === 404) throw new LoyverseApiError(`Loyverse endpoint not found (HTTP 404): ${url}`, 404);
      if (res.status === 429) throw new LoyverseApiError("Loyverse rate limit exceeded (HTTP 429) — retry later", 429);
      if (res.status >= 500) throw new LoyverseApiError(`Loyverse server error (HTTP ${res.status})`, res.status);
      throw new LoyverseApiError(`Loyverse API error (HTTP ${res.status}) on ${path}: ${body}`, res.status);
    }

    return res.json() as Promise<T>;
  }

  private async fetchTextWithAuth(path: string): Promise<{ url: string; status: number; text: string }> {
    const url = `${this.baseUrl}${path}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: this.authHeaders });
    } catch (err) {
      throw new LoyverseApiError(
        `Network error calling Loyverse (${path}): ${err instanceof Error ? err.message : String(err)}`
      );
    }
    const text = await res.text();
    return { url, status: res.status, text };
  }

  // ─── Raw fetch methods ────────────────────────────────────────────────────

  async fetchRawCategories(): Promise<SyncResult<LoyverseRawCategory[]>> {
    try {
      if (this.mockMode) return { success: true, data: MOCK_CATALOG.categories };
      const data = await this.fetchWithAuth<{ categories: LoyverseRawCategory[] }>("/categories");
      return { success: true, data: Array.isArray(data.categories) ? data.categories : [] };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async fetchRawModifiers(): Promise<SyncResult<LoyverseRawModifier[]>> {
    try {
      if (this.mockMode) return { success: true, data: MOCK_CATALOG.modifiers };
      const all: LoyverseRawModifier[] = [];
      let cursor: string | null = null;
      do {
        const qs: string = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
        type ModPage = { modifiers: Array<LoyverseRawModifier & { modifier_options?: LoyverseRawModifier["options"] }>; cursor: string | null };
        const page: ModPage = await this.fetchWithAuth<ModPage>(`/modifiers${qs}`);
        if (Array.isArray(page.modifiers)) {
          all.push(...page.modifiers.map((m: LoyverseRawModifier & { modifier_options?: LoyverseRawModifier["options"] }) => ({ ...m, options: m.options ?? m.modifier_options })));
        }
        cursor = page.cursor ?? null;
      } while (cursor);
      return { success: true, data: all };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async fetchRawItems(): Promise<SyncResult<LoyverseRawItem[]>> {
    try {
      if (this.mockMode) {
        this._itemsDiagnostics = {
          loyverseMock: true,
          requestUrl: null,
          httpStatus: null,
          rawBodyContainsModifiersIds: null,
          rawBodyPreview: null,
          usingFallback: false,
          usingCache: false,
        };
        return { success: true, data: MOCK_CATALOG.items };
      }

      const all: LoyverseRawItem[] = [];
      let cursor: string | null = null;
      let pageNum = 0;

      do {
        const qs: string = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
        if (pageNum === 0) {
          const raw = await this.fetchTextWithAuth(`/items${qs}`);
          const containsModifierIds = raw.text.includes('"modifier_ids"');
          const preview = raw.text.slice(0, RAW_BODY_PREVIEW_LENGTH);
          this._itemsDiagnostics = {
            loyverseMock: false,
            requestUrl: raw.url,
            httpStatus: raw.status,
            rawBodyContainsModifiersIds: containsModifierIds,
            rawBodyPreview: preview,
            usingFallback: false,
            usingCache: false,
          };
          if (raw.status >= 400) {
            if (raw.status === 401) throw new LoyverseApiError("Loyverse authentication failed", 401);
            if (raw.status === 429) throw new LoyverseApiError("Loyverse rate limit exceeded", 429);
            if (raw.status >= 500) throw new LoyverseApiError(`Loyverse server error (HTTP ${raw.status})`, raw.status);
            throw new LoyverseApiError(`Loyverse API error (HTTP ${raw.status})`, raw.status);
          }
          const page = JSON.parse(raw.text) as { items: LoyverseRawItem[]; cursor: string | null };
          if (Array.isArray(page.items)) all.push(...page.items);
          cursor = page.cursor ?? null;
        } else {
          const page: { items: LoyverseRawItem[]; cursor: string | null } = await this.fetchWithAuth<{ items: LoyverseRawItem[]; cursor: string | null }>(`/items${qs}`);
          if (Array.isArray(page.items)) all.push(...page.items);
          cursor = page.cursor ?? null;
        }
        pageNum++;
      } while (cursor);

      return { success: true, data: all };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async fetchRawPaymentTypes(): Promise<SyncResult<LoyverseRawPaymentType[]>> {
    try {
      if (this.mockMode) return { success: true, data: MOCK_PAYMENT_TYPES };
      const data = await this.fetchWithAuth<{ payment_types: LoyverseRawPaymentType[] }>("/payment_types");
      return { success: true, data: Array.isArray(data.payment_types) ? data.payment_types : [] };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async fetchRawReceipts(
    options: { after?: string; before?: string } = {}
  ): Promise<SyncResult<LoyverseRawReceipt[]>> {
    try {
      if (this.mockMode) return { success: true, data: MOCK_RECEIPTS };

      const all: LoyverseRawReceipt[] = [];
      let cursor: string | null = null;

      do {
        const params = new URLSearchParams();
        if (cursor) params.set("cursor", cursor);
        if (options.after) params.set("created_at_min", options.after);
        if (options.before) params.set("created_at_max", options.before);
        const qs: string = params.toString() ? `?${params.toString()}` : "";
        const page: { receipts: LoyverseRawReceipt[]; cursor: string | null } =
          await this.fetchWithAuth<{ receipts: LoyverseRawReceipt[]; cursor: string | null }>(
            `/receipts${qs}`
          );
        if (Array.isArray(page.receipts)) all.push(...page.receipts);
        cursor = page.cursor ?? null;
      } while (cursor);

      return { success: true, data: all };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Fetch full raw catalogue (items + categories + modifiers) in parallel. */
  async fetchRawCatalog(): Promise<SyncResult<LoyverseCatalogRaw>> {
    try {
      const [itemsResult, categoriesResult, modifiersResult] = await Promise.all([
        this.fetchRawItems(),
        this.fetchRawCategories(),
        this.fetchRawModifiers(),
      ]);
      if (!itemsResult.success) return { success: false, error: itemsResult.error };
      if (!categoriesResult.success) return { success: false, error: categoriesResult.error };
      if (!modifiersResult.success) return { success: false, error: modifiersResult.error };
      return {
        success: true,
        data: {
          items: itemsResult.data!,
          categories: categoriesResult.data!,
          modifiers: modifiersResult.data!,
        },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** @deprecated Use fetchRawItems() instead */
  async fetchItems(): Promise<LoyverseRawItem[]> {
    const result = await this.fetchRawItems();
    if (!result.success) throw new LoyverseApiError(result.error ?? "fetchItems failed");
    return result.data!;
  }

  /** @deprecated Use fetchRawCategories() instead */
  async fetchCategories(): Promise<LoyverseRawCategory[]> {
    const result = await this.fetchRawCategories();
    if (!result.success) throw new LoyverseApiError(result.error ?? "fetchCategories failed");
    return result.data!;
  }

  /** @deprecated Use fetchRawModifiers() instead */
  async fetchModifiers(): Promise<LoyverseRawModifier[]> {
    const result = await this.fetchRawModifiers();
    if (!result.success) throw new LoyverseApiError(result.error ?? "fetchModifiers failed");
    return result.data!;
  }

  async fetchVariants(): Promise<LoyverseRawVariant[]> {
    if (this.mockMode) return [];
    const all: LoyverseRawVariant[] = [];
    let cursor: string | null = null;
    do {
      const qs: string = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const page: { variants: LoyverseRawVariant[]; cursor: string | null } =
        await this.fetchWithAuth<{ variants: LoyverseRawVariant[]; cursor: string | null }>(`/variants${qs}`);
      if (Array.isArray(page.variants)) all.push(...page.variants);
      cursor = page.cursor ?? null;
    } while (cursor);
    return all;
  }

  async fetchInventory(): Promise<LoyverseRawInventoryLevel[]> {
    if (this.mockMode) return [];
    const all: LoyverseRawInventoryLevel[] = [];
    let cursor: string | null = null;
    do {
      const qs: string = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const page: { inventory_levels: LoyverseRawInventoryLevel[]; cursor: string | null } =
        await this.fetchWithAuth<{ inventory_levels: LoyverseRawInventoryLevel[]; cursor: string | null }>(
          `/inventory${qs}`
        );
      if (Array.isArray(page.inventory_levels)) all.push(...page.inventory_levels);
      cursor = page.cursor ?? null;
    } while (cursor);
    return all;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createLoyverseAdapter(): LoyverseAdapter {
  const token = process.env.LOYVERSE_API_TOKEN ?? "";
  const baseUrl = process.env.LOYVERSE_API_BASE_URL;
  return new LoyverseAdapter(token, baseUrl);
}

export function isLoyverseEnabled(): boolean {
  return !!process.env.LOYVERSE_API_TOKEN;
}

export function isLoyverseMockMode(): boolean {
  return process.env.LOYVERSE_MOCK === "true" || !process.env.LOYVERSE_API_TOKEN;
}
