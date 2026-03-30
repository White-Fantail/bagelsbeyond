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
  LoyverseRawModifier,
  LoyverseRawVariant,
  LoyverseRawInventoryLevel,
  LoyverseCatalogRaw,
} from "./types";
import { normalizeLoyverseCatalog } from "../../services/catalog-mapper";

const DEFAULT_BASE_URL = "https://api.loyverse.com/v1.0";

/** Maximum number of characters captured from the raw HTTP body for diagnostic preview. */
const RAW_BODY_PREVIEW_LENGTH = 10_000;

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

// ─── HTTP pipeline diagnostics ────────────────────────────────────────────────

/**
 * Diagnostics captured at each stage of the /items HTTP pipeline.
 * Populated by fetchItems() and accessible via adapter.itemsDiagnostics.
 */
export interface ItemsFetchDiagnostics {
  /** Whether LOYVERSE_MOCK mode was active (no real HTTP call made) */
  loyverseMock: boolean;
  /** Actual URL that was called (null in mock mode) */
  requestUrl: string | null;
  /** HTTP response status code (null in mock mode) */
  httpStatus: number | null;
  /** Whether the literal string `"modifier_ids"` appears anywhere in the raw HTTP body text */
  rawBodyContainsModifiersIds: boolean | null;
  /** First 10 000 characters of the raw HTTP body (null in mock mode) */
  rawBodyPreview: string | null;
  /** Always false — no fallback payload is used */
  usingFallback: boolean;
  /** Always false — no in-memory cache is used */
  usingCache: boolean;
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
      modifier_ids: [],
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
      modifier_ids: ["mock-mod-group-002"],
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
  modifiers: [
    {
      id: "mock-mod-group-001",
      name: "Toppings",
      options: [
        { id: "mock-mod-001", name: "Extra Cream Cheese", price: 1.0 },
        { id: "mock-mod-002", name: "Avocado", price: 2.0 },
        { id: "mock-mod-003", name: "Smoked Salmon", price: 3.5 },
      ],
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-06-01T00:00:00.000Z",
      deleted_at: null,
    },
    {
      id: "mock-mod-group-002",
      name: "Milk Choice",
      options: [
        { id: "mock-mod-004", name: "Regular Milk", price: 0 },
        { id: "mock-mod-005", name: "Oat Milk", price: 0.8 },
        { id: "mock-mod-006", name: "Soy Milk", price: 0.5 },
      ],
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-06-01T00:00:00.000Z",
      deleted_at: null,
    },
  ],
};

const MOCK_VARIANTS: LoyverseRawVariant[] = [
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
  {
    variant_id: "mock-var-002",
    item_id: "mock-item-002",
    sku: "SKU-BAGEL-002",
    reference_id: null,
    barcode: null,
    cost: 1.8,
    default_pricing_type: "FIXED",
    default_price: 6.5,
    stores: [{ store_id: "mock-store-001", pricing_type: "FIXED", price: 6.5, available_for_sale: true }],
    option1_name: null,
    option1_val: null,
    option2_name: null,
    option2_val: null,
    option3_name: null,
    option3_val: null,
  },
  {
    variant_id: "mock-var-003",
    item_id: "mock-item-003",
    sku: null,
    reference_id: null,
    barcode: null,
    cost: 0.5,
    default_pricing_type: "FIXED",
    default_price: 5.0,
    stores: [{ store_id: "mock-store-001", pricing_type: "FIXED", price: 5.0, available_for_sale: true }],
    option1_name: null,
    option1_val: null,
    option2_name: null,
    option2_val: null,
    option3_name: null,
    option3_val: null,
  },
];

const MOCK_INVENTORY: LoyverseRawInventoryLevel[] = [
  { variant_id: "mock-var-001", store_id: "mock-store-001", in_stock: 10, updated_at: "2024-06-01T00:00:00.000Z" },
  { variant_id: "mock-var-002", store_id: "mock-store-001", in_stock: 8, updated_at: "2024-06-01T00:00:00.000Z" },
  { variant_id: "mock-var-003", store_id: "mock-store-001", in_stock: 20, updated_at: "2024-06-01T00:00:00.000Z" },
];

// ─── Loyverse Adapter ─────────────────────────────────────────────────────────

export class LoyverseAdapter implements POSAdapter {
  private readonly apiToken: string;
  private readonly baseUrl: string;
  private readonly storeId: string;
  private readonly mockMode: boolean;
  /** Populated after each fetchItems() call — null until first call. */
  private _itemsDiagnostics: ItemsFetchDiagnostics | null = null;

  constructor(apiToken: string, baseUrl?: string, storeId?: string) {
    this.apiToken = apiToken;
    this.baseUrl = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.storeId = storeId ?? "";
    this.mockMode = process.env.LOYVERSE_MOCK === "true" || !apiToken;
  }

  /** HTTP pipeline diagnostics captured during the last fetchItems() call. */
  get itemsDiagnostics(): ItemsFetchDiagnostics | null {
    return this._itemsDiagnostics;
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
   * On non-2xx responses, logs request URL, method, HTTP status, and response body.
   */
  private async fetchWithAuth<T>(
    path: string,
    options?: { method?: string; body?: string }
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const method = options?.method ?? "GET";
    console.debug(`[Loyverse] ${method} ${url}`);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: this.authHeaders,
        body: options?.body,
      });
    } catch (err) {
      throw new LoyverseApiError(
        `Network error calling Loyverse (${path}): ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!res.ok) {
      let responseBody = "";
      try {
        responseBody = await res.text();
      } catch {
        responseBody = "(unable to read response body)";
      }
      console.error(
        `[Loyverse] HTTP ${res.status} on ${method} ${url} — body: ${responseBody}`
      );

      if (res.status === 401) {
        throw new LoyverseApiError(
          "Loyverse authentication failed — check LOYVERSE_API_TOKEN",
          401
        );
      }
      if (res.status === 404) {
        throw new LoyverseApiError(
          `Loyverse endpoint not found (HTTP 404): ${url}`,
          404
        );
      }
      if (res.status === 422) {
        throw new LoyverseApiError(
          `Loyverse unprocessable entity (HTTP 422) on ${path} — body: ${responseBody}`,
          422
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
      throw new LoyverseApiError(
        `Loyverse API error (HTTP ${res.status}) on ${path}`,
        res.status
      );
    }

    const data = (await res.json()) as T;
    console.debug(
      `[Loyverse] HTTP ${res.status} OK on ${method} ${url} (content-type: ${res.headers.get("content-type") ?? "unknown"})`
    );
    return data;
  }

  /**
   * Low-level fetch that returns the raw HTTP body text along with status.
   * Used to capture the HTTP body string BEFORE JSON.parse so diagnostics can
   * verify field presence (e.g. `"modifier_ids"`) at the wire level.
   * Does NOT include error handling — callers must check `status` themselves.
   */
  private async fetchTextWithAuth(
    path: string
  ): Promise<{ url: string; status: number; text: string }> {
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

  /**
   * Fetch all items (products) from Loyverse, following cursor-based pagination.
   * Logs raw payload diagnostics on the first page so the presence/absence of
   * `modifier_ids` in the API response can be verified before any processing.
   */
  async fetchItems(): Promise<LoyverseRawItem[]> {
    if (this.mockMode) {
      console.info(
        `[Loyverse] fetchItems: mockMode=true LOYVERSE_MOCK=${process.env.LOYVERSE_MOCK ?? "unset"} — returning MOCK_CATALOG items`
      );
      this._itemsDiagnostics = {
        loyverseMock: true,
        requestUrl: null,
        httpStatus: null,
        rawBodyContainsModifiersIds: null,
        rawBodyPreview: null,
        usingFallback: false,
        usingCache: false,
      };
      MOCK_CATALOG.items.slice(0, 3).forEach((item, idx) => {
        const rawObj = item as unknown as Record<string, unknown>;
        console.info(`[RAW ITEM #${idx + 1} KEYS] ${JSON.stringify(Object.keys(rawObj))}`);
        const modIds = rawObj["modifier_ids"];
        console.info(
          `[RAW ITEM #${idx + 1} modifier_ids] ${modIds !== undefined ? JSON.stringify(modIds) : "FIELD ABSENT"}`
        );
      });
      return MOCK_CATALOG.items;
    }

    console.info(
      `[Loyverse] fetchItems: mockMode=false LOYVERSE_MOCK=${process.env.LOYVERSE_MOCK ?? "unset"} url=${this.baseUrl}/items`
    );

    const allItems: LoyverseRawItem[] = [];
    let cursor: string | null = null;
    let pageNum = 0;

    do {
      const query: string = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";

      let page: { items: LoyverseRawItem[]; cursor: string | null };

      if (pageNum === 0) {
        // ── First page: capture HTTP body text BEFORE JSON.parse ─────────────
        // This lets us verify field presence (e.g. "modifier_ids") at the
        // actual wire level, before any JavaScript transformation.
        const rawResult = await this.fetchTextWithAuth(`/items${query}`);
        const rawText = rawResult.text;
        const httpStatus = rawResult.status;
        const requestUrl = rawResult.url;

        // Log the HTTP-level diagnostics
        console.info(`[HTTP STATUS] ${httpStatus}`);
        console.info(`[HTTP URL] ${requestUrl}`);
        console.info(`[LOYVERSE_MOCK] ${process.env.LOYVERSE_MOCK ?? "unset"}`);
        console.info(`[USING FALLBACK] false`);
        console.info(`[USING CACHE] false`);
        const rawBodyContains = rawText.includes('"modifier_ids"');
        console.info(`[RAW BODY CONTAINS "modifier_ids"] ${rawBodyContains}`);
        const bodyPreview = rawText.slice(0, RAW_BODY_PREVIEW_LENGTH);
        console.info(`[RAW BODY PREVIEW] ${bodyPreview}`);

        // Store diagnostics for callers (e.g. syncAllLoyverse)
        this._itemsDiagnostics = {
          loyverseMock: false,
          requestUrl,
          httpStatus,
          rawBodyContainsModifiersIds: rawBodyContains,
          rawBodyPreview: bodyPreview,
          usingFallback: false,
          usingCache: false,
        };

        // Handle non-2xx the same way fetchWithAuth does
        if (httpStatus >= 400) {
          if (httpStatus === 401) {
            throw new LoyverseApiError("Loyverse authentication failed — check LOYVERSE_API_TOKEN", 401);
          }
          if (httpStatus === 404) {
            throw new LoyverseApiError(`Loyverse endpoint not found (HTTP 404): ${requestUrl}`, 404);
          }
          if (httpStatus === 429) {
            throw new LoyverseApiError("Loyverse rate limit exceeded (HTTP 429) — retry later", 429);
          }
          if (httpStatus >= 500) {
            throw new LoyverseApiError(`Loyverse server error (HTTP ${httpStatus}) — try again later`, httpStatus);
          }
          throw new LoyverseApiError(`Loyverse API error (HTTP ${httpStatus}) on /items`, httpStatus);
        }

        // JSON.parse the captured text (this is the step AFTER HTTP raw body)
        page = JSON.parse(rawText) as { items: LoyverseRawItem[]; cursor: string | null };

        // Log JSON.parse diagnostics
        if (Array.isArray(page.items)) {
          const sample = page.items.slice(0, 3);
          sample.forEach((rawItem, idx) => {
            const rawObj = rawItem as unknown as Record<string, unknown>;
            console.info(`[JSON ITEM #${idx + 1} KEYS] ${JSON.stringify(Object.keys(rawObj))}`);
            const modIds = rawObj["modifier_ids"];
            console.info(
              `[JSON ITEM #${idx + 1} modifier_ids] ${modIds !== undefined ? JSON.stringify(modIds) : "FIELD ABSENT"}`
            );
            console.info(`[JSON ITEM #${idx + 1} FULL JSON] ${JSON.stringify(rawItem)}`);
          });

          const total = page.items.length;
          const withField = page.items.filter(
            (i) => "modifier_ids" in (i as unknown as Record<string, unknown>)
          ).length;
          console.info(
            `[JSON PAGE 1 SUMMARY] items=${total} with_modifier_ids_field=${withField} without=${total - withField}`
          );
        }
      } else {
        // Subsequent pages go through the normal fetchWithAuth path
        page = await this.fetchWithAuth<{
          items: LoyverseRawItem[];
          cursor: string | null;
        }>(`/items${query}`);
      }

      if (Array.isArray(page.items)) {
        allItems.push(...page.items);
      }
      cursor = page.cursor ?? null;
      pageNum++;
    } while (cursor);

    console.info(`[Loyverse] Fetched ${allItems.length} items (${pageNum} page(s))`);
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
   * Fetch all modifiers from Loyverse, following cursor-based pagination.
   * In the Loyverse API a "modifier" is a group of selectable options
   * (e.g. "Milk Choice" with options "Regular Milk", "Oat Milk").
   * Endpoint: GET /modifiers
   * Docs: https://developer.loyverse.com/docs/#tag/Modifiers/paths/~1modifiers/get
   */
  async fetchModifiers(): Promise<LoyverseRawModifier[]> {
    if (this.mockMode) {
      return MOCK_CATALOG.modifiers;
    }

    const allModifiers: LoyverseRawModifier[] = [];
    let cursor: string | null = null;

    do {
      const query: string = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      // The real Loyverse API v1.0 uses "modifier_options" for the options array
      // inside each modifier group. We normalise it to "options" here so the rest
      // of the codebase (and tests) can use the stable internal field name.
      const page = await this.fetchWithAuth<{
        modifiers: Array<LoyverseRawModifier & { modifier_options?: LoyverseRawModifier["options"] }>;
        cursor: string | null;
      }>(`/modifiers${query}`);

      if (Array.isArray(page.modifiers)) {
        const normalised = page.modifiers.map((m) => ({
          ...m,
          options: m.options ?? m.modifier_options,
        }));
        allModifiers.push(...normalised);
      }
      cursor = page.cursor ?? null;
    } while (cursor);

    console.info(`[Loyverse] Fetched ${allModifiers.length} modifiers`);
    return allModifiers;
  }

  /**
   * Fetch all variants from Loyverse, following cursor-based pagination.
   * Endpoint: GET /variants
   */
  async fetchVariants(): Promise<LoyverseRawVariant[]> {
    if (this.mockMode) {
      console.info("[Loyverse] Mock mode — returning mock variants");
      return MOCK_VARIANTS;
    }

    const allVariants: LoyverseRawVariant[] = [];
    let cursor: string | null = null;

    do {
      const query: string = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const page: { variants: LoyverseRawVariant[]; cursor: string | null } =
        await this.fetchWithAuth<{
          variants: LoyverseRawVariant[];
          cursor: string | null;
        }>(`/variants${query}`);

      if (Array.isArray(page.variants)) {
        allVariants.push(...page.variants);
      }
      cursor = page.cursor ?? null;
    } while (cursor);

    console.info(`[Loyverse] Fetched ${allVariants.length} variants`);
    return allVariants;
  }

  /**
   * Fetch inventory levels from Loyverse, following cursor-based pagination.
   * Endpoint: GET /inventory
   */
  async fetchInventory(): Promise<LoyverseRawInventoryLevel[]> {
    if (this.mockMode) {
      console.info("[Loyverse] Mock mode — returning mock inventory");
      return MOCK_INVENTORY;
    }

    const allLevels: LoyverseRawInventoryLevel[] = [];
    let cursor: string | null = null;

    do {
      const query: string = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const page: { inventory_levels: LoyverseRawInventoryLevel[]; cursor: string | null } =
        await this.fetchWithAuth<{
          inventory_levels: LoyverseRawInventoryLevel[];
          cursor: string | null;
        }>(`/inventory${query}`);

      if (Array.isArray(page.inventory_levels)) {
        allLevels.push(...page.inventory_levels);
      }
      cursor = page.cursor ?? null;
    } while (cursor);

    console.info(`[Loyverse] Fetched ${allLevels.length} inventory levels`);
    return allLevels;
  }

  /**
   * Fetch the full raw catalogue (items + categories + modifiers) in one call.
   */
  async fetchCatalog(): Promise<LoyverseCatalogRaw> {
    const [items, categories, modifiers] = await Promise.all([
      this.fetchItems(),
      this.fetchCategories(),
      this.fetchModifiers(),
    ]);
    return { items, categories, modifiers };
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
   * Push an order to Loyverse as a receipt.
   * Maps internal Order fields to the Loyverse POST /receipts payload.
   * Loyverse docs: https://developer.loyverse.com/docs/#tag/Receipts/paths/~1receipts/post
   */
  async pushOrderToExternalPos(
    order: ExternalOrder
  ): Promise<SyncResult<{ externalOrderId: string }>> {
    if (!this.apiToken) {
      return { success: false, error: "LOYVERSE_API_TOKEN is not configured" };
    }

    if (!this.storeId) {
      return { success: false, error: "LOYVERSE_STORE_ID is not configured" };
    }

    if (this.mockMode) {
      const mockReceiptNumber = `MOCK-${order.orderNumber ?? order.externalId}`;
      console.info(`[Loyverse] Mock mode — simulated receipt ${mockReceiptNumber}`);
      return { success: true, data: { externalOrderId: mockReceiptNumber } };
    }

    try {
      interface LoyverseReceiptModifier {
        modifier_option_id: string;
        price: number;
      }

      const line_items = order.items.map((item) => ({
        ...(item.externalProductId ? { variant_id: item.externalProductId } : {}),
        quantity: item.quantity,
        price: item.unitPrice,
        line_modifiers: (item.modifiers ?? [])
          .filter((m) => !!m.modifierId)
          .map((m): LoyverseReceiptModifier => ({
            modifier_option_id: m.modifierId!,
            price: m.price,
          })),
      }));

      const payload = {
        order: order.orderNumber ?? order.externalId,
        store_id: this.storeId,
        note: order.note ?? null,
        receipt_date: order.createdAt.toISOString(),
        line_items,
      };

      console.info("[Loyverse] Sending receipt payload", {
        order: payload.order,
        store_id: payload.store_id,
        line_item_count: line_items.length,
        line_items: line_items.map((li) => ({
          variant_id: "variant_id" in li ? li.variant_id : null,
          quantity: li.quantity,
          line_modifier_count: li.line_modifiers.length,
          line_modifiers: li.line_modifiers.map((m) => ({
            modifier_option_id: m.modifier_option_id,
            price: m.price,
          })),
        })),
      });

      const res = await this.fetchWithAuth<{ receipt_number: string }>(
        "/receipts",
        { method: "POST", body: JSON.stringify(payload) }
      );

      console.info(`[Loyverse] Pushed receipt ${res.receipt_number}`);
      return { success: true, data: { externalOrderId: res.receipt_number } };
    } catch (err) {
      const message =
        err instanceof LoyverseApiError
          ? err.message
          : `Unexpected error: ${String(err)}`;
      console.error("[Loyverse] pushOrderToExternalPos failed:", message);
      return { success: false, error: message };
    }
  }

  /**
   * Sync daily sold quantities from Loyverse receipts for a given date.
   * Fetches GET /receipts with date range and aggregates line_item quantities
   * by Loyverse item_id (= externalProductId).
   */
  async syncInventoryFromExternal(
    date: Date
  ): Promise<SyncResult<Record<string, number>>> {
    if (!this.apiToken) {
      return { success: false, error: "LOYVERSE_API_TOKEN is not configured" };
    }

    if (this.mockMode) {
      console.info("[Loyverse] Mock mode — returning empty inventory sync");
      return { success: true, data: {} };
    }

    try {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      const soldQty: Record<string, number> = {};
      let cursor: string | null = null;

      do {
        const params = new URLSearchParams({
          created_at_min: start.toISOString(),
          created_at_max: end.toISOString(),
        });
        if (cursor) params.set("cursor", cursor);

        const page = await this.fetchWithAuth<{
          receipts: Array<{
            line_items?: Array<{ item_id?: string | null; quantity?: number }>;
          }>;
          cursor: string | null;
        }>(`/receipts?${params.toString()}`);

        if (Array.isArray(page.receipts)) {
          for (const receipt of page.receipts) {
            for (const line of receipt.line_items ?? []) {
              if (!line.item_id) continue;
              soldQty[line.item_id] = (soldQty[line.item_id] ?? 0) + (line.quantity ?? 1);
            }
          }
        }

        cursor = page.cursor ?? null;
      } while (cursor);

      console.info(
        `[Loyverse] Synced inventory for ${date.toISOString().slice(0, 10)}: ${Object.keys(soldQty).length} items`
      );
      return { success: true, data: soldQty };
    } catch (err) {
      const message =
        err instanceof LoyverseApiError
          ? err.message
          : `Unexpected error: ${String(err)}`;
      console.error("[Loyverse] syncInventoryFromExternal failed:", message);
      return { success: false, error: message };
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create a LoyverseAdapter from environment variables. */
export function createLoyverseAdapter(): LoyverseAdapter {
  const token = process.env.LOYVERSE_API_TOKEN ?? "";
  const baseUrl = process.env.LOYVERSE_API_BASE_URL ?? DEFAULT_BASE_URL;
  const storeId = process.env.LOYVERSE_STORE_ID ?? "";
  return new LoyverseAdapter(token, baseUrl, storeId);
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
