import "server-only";

const LOYVERSE_API_BASE = "https://api.loyverse.com/v1.0";
const DEFAULT_CURRENCY_CODE = "NZD";
const LOYVERSE_ITEMS_PAGE_SIZE = "250";
const LOYVERSE_PAYMENT_TYPES_PAGE_SIZE = "250";
const LOYVERSE_PAYMENT_TYPE_CACHE_TTL_MS = 10 * 60 * 1000;
const LOYVERSE_EMPTY_PAYMENT_TYPE_CACHE_TTL_MS = 60 * 1000;

export type LoyverseOrderResult =
  | {
      success: true;
      receiptId: string;
    }
  | {
      success: false;
      error: string;
    };

export type CartItemForLoyverse = {
  itemId: string | null;
  itemNameSnapshot: string;
  quantity: number;
  unitPrice: number;
  modifiers: Array<{
    modifierId?: string | null;
    modifierGroupName: string;
    modifierOptionName: string;
    priceDelta: number;
  }>;
};

export type CreateLoyversePickupOrderInput = {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  pickupType: string;
  pickupTime?: Date | null;
  notes?: string | null;
  items: CartItemForLoyverse[];
  subtotal: number;
  total: number;
};

type LoyverseReceiptPayload = {
  store_id: string;
  receipt_number: string;
  line_items: Array<{
    item_id?: string;
    variant_id?: string;
    item_name: string;
    quantity: number;
    price: number;
    line_modifiers?: Array<{
      modifier_id?: string;
      name: string;
      price: number;
    }>;
  }>;
  total_money: {
    amount: number;
    currency_code: string;
  };
  payments: Array<{
    payment_type_id: string;
    money_amount: {
      amount: number;
      currency_code: string;
    };
  }>;
  note?: string;
};

type LoyversePaymentType = {
  id: string;
  name: string;
};

type PaymentTypeCacheEntry = {
  value: LoyversePaymentType | null;
  expiresAt: number;
};

let paymentTypeCache: PaymentTypeCacheEntry | null = null;
let inflightPaymentTypePromise: Promise<LoyversePaymentType | null> | null = null;

function toMoneyAmount(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100);
}

function normalizeErrorCode(code: string): string {
  return code.replace(/[^A-Z0-9_]/g, "_");
}

function buildFailure(code: string, detail: string): LoyverseOrderResult {
  const normalizedCode = normalizeErrorCode(code.toUpperCase());
  return {
    success: false,
    error: `${normalizedCode}: ${detail}`,
  };
}

function normalizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeOptionalId(value: unknown): string | undefined {
  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : undefined;
}

function buildOrderNote(input: CreateLoyversePickupOrderInput): string {
  const noteParts = [
    `Customer: ${input.customerName} (${input.customerPhone})`,
    `Pickup: ${input.pickupType}${input.pickupTime ? ` @ ${input.pickupTime.toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" })}` : ""}`,
    input.notes?.trim() ? `Note: ${input.notes.trim()}` : "",
  ].filter(Boolean);

  return noteParts.join(" | ");
}

function mapLineItems(
  items: CartItemForLoyverse[],
  variantIdByItemId?: Map<string, string>
): LoyverseReceiptPayload["line_items"] {
  return items.map((item) => ({
    item_id: item.itemId ?? undefined,
    variant_id: item.itemId ? variantIdByItemId?.get(item.itemId) : undefined,
    item_name: item.itemNameSnapshot,
    quantity: item.quantity,
    price: toMoneyAmount(item.unitPrice),
    line_modifiers:
      item.modifiers.length > 0
        ? item.modifiers.map((modifier) => ({
            modifier_id: normalizeOptionalId(modifier.modifierId),
            name: `${modifier.modifierGroupName}: ${modifier.modifierOptionName}`,
            price: toMoneyAmount(modifier.priceDelta),
          }))
        : undefined,
  }));
}

export function mapCartToLoyversePayload(
  input: CreateLoyversePickupOrderInput,
  storeId: string,
  paymentTypeId: string,
  variantIdByItemId?: Map<string, string>
): LoyverseReceiptPayload {
  const totalAmount = toMoneyAmount(input.total);
  return {
    store_id: storeId,
    receipt_number: input.orderNumber,
    line_items: mapLineItems(input.items, variantIdByItemId),
    total_money: {
      amount: totalAmount,
      currency_code: DEFAULT_CURRENCY_CODE,
    },
    payments: [
      {
        payment_type_id: paymentTypeId,
        money_amount: {
          amount: totalAmount,
          currency_code: DEFAULT_CURRENCY_CODE,
        },
      },
    ],
    note: buildOrderNote(input),
  };
}

function extractVariantId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const directCandidate = normalizeString(
    row.variant_id ?? row.variantId ?? row.item_variant_id ?? row.itemVariantId
  );
  return directCandidate || null;
}

async function resolveVariantIdByItemId(
  itemIds: string[],
  accessToken: string
): Promise<Map<string, string>> {
  const targetIds = new Set(itemIds.filter((id) => normalizeString(id).length > 0));
  const resolved = new Map<string, string>();
  if (targetIds.size === 0) return resolved;

  let cursor: string | null = null;

  do {
    const url = new URL(`${LOYVERSE_API_BASE}/items`);
    url.searchParams.set("limit", LOYVERSE_ITEMS_PAGE_SIZE);
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: ["Bearer", accessToken].join(" "),
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to resolve Loyverse variants", response.status, errorText);
      break;
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      break;
    }

    if (!payload || typeof payload !== "object") break;
    const row = payload as Record<string, unknown>;
    const items = Array.isArray(row.items) ? row.items : [];

    for (const itemRaw of items) {
      if (!itemRaw || typeof itemRaw !== "object") continue;
      const item = itemRaw as Record<string, unknown>;
      const itemId = normalizeString(item.id ?? item.item_id);
      if (!itemId || !targetIds.has(itemId) || resolved.has(itemId)) continue;

      const defaultVariantId = normalizeString(item.default_variant_id ?? item.defaultVariantId);
      const variants = Array.isArray(item.variants) ? item.variants : [];
      let variantId: string | null = null;
      if (defaultVariantId) {
        variantId = defaultVariantId;
      } else if (variants.length > 0) {
        variantId = extractVariantId(variants[0]);
      }

      if (variantId) {
        resolved.set(itemId, variantId);
      }
    }

    cursor = normalizeString(row.cursor) || null;
  } while (cursor && resolved.size < targetIds.size);

  return resolved;
}

async function parseLoyverseErrorResponse(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as Record<string, unknown>;
      const reasonCandidate = payload.message ?? payload.error ?? payload.detail;
      if (typeof reasonCandidate === "string" && reasonCandidate.trim()) {
        return reasonCandidate.trim();
      }
      return JSON.stringify(payload);
    } catch {
      return "Invalid JSON error response";
    }
  }

  const text = await response.text();
  return text.trim() || "No error body";
}

function normalizeBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function extractPaymentType(raw: unknown): LoyversePaymentType | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = normalizeString(row.id ?? row.payment_type_id ?? row.paymentTypeId);
  const name = normalizeString(row.name ?? row.payment_type_name ?? row.paymentTypeName);
  const isArchived = normalizeBoolean(row.is_archived ?? row.isArchived ?? row.archived);
  const isIntegrated = normalizeBoolean(
    row.is_integrated ?? row.isIntegrated ?? row.integrated,
  );
  if (!id || isArchived || isIntegrated) return null;
  return {
    id,
    name,
  };
}

async function fetchDefaultPaymentType(accessToken: string): Promise<LoyversePaymentType | null> {
  const now = Date.now();
  if (paymentTypeCache && paymentTypeCache.expiresAt > now) {
    return paymentTypeCache.value;
  }

  if (inflightPaymentTypePromise) {
    return inflightPaymentTypePromise;
  }

  inflightPaymentTypePromise = (async () => {
    let paginationCursor: string | null = null;
    const allPaymentTypes: LoyversePaymentType[] = [];

    do {
      const url = new URL(`${LOYVERSE_API_BASE}/payment_types`);
      url.searchParams.set("limit", LOYVERSE_PAYMENT_TYPES_PAGE_SIZE);
      if (paginationCursor) {
        url.searchParams.set("cursor", paginationCursor);
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: ["Bearer", accessToken].join(" "),
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const detail = await parseLoyverseErrorResponse(response);
        throw new Error(`Failed to fetch payment types: status ${response.status} - ${detail}`);
      }

      const payload = (await response.json()) as Record<string, unknown>;
      let paymentTypesRaw: unknown[] = [];
      if (Array.isArray(payload.payment_types)) {
        paymentTypesRaw = payload.payment_types;
      } else if (Array.isArray(payload.items)) {
        paymentTypesRaw = payload.items;
      } else if (Array.isArray(payload.data)) {
        paymentTypesRaw = payload.data;
      }

      for (const paymentTypeRaw of paymentTypesRaw) {
        const paymentType = extractPaymentType(paymentTypeRaw);
        if (!paymentType) continue;
        allPaymentTypes.push(paymentType);
      }

      paginationCursor = normalizeString(payload.cursor) || null;
    } while (paginationCursor);

    const cashPaymentType = allPaymentTypes.find(
      (pt) => pt.name.toLowerCase() === "cash",
    );
    const selected = cashPaymentType ?? allPaymentTypes[0] ?? null;

    paymentTypeCache = {
      value: selected,
      expiresAt: Date.now() + (selected ? LOYVERSE_PAYMENT_TYPE_CACHE_TTL_MS : LOYVERSE_EMPTY_PAYMENT_TYPE_CACHE_TTL_MS),
    };
    return selected;
  })();

  try {
    return await inflightPaymentTypePromise;
  } finally {
    inflightPaymentTypePromise = null;
  }
}

function extractReceiptId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const row = payload as Record<string, unknown>;
  const candidate = row.id ?? row.receipt_id ?? row.receipt_number;

  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.trim();
  }

  return null;
}

export function getOrderSyncUpdateFromLoyverseResult(result: LoyverseOrderResult) {
  if (result.success) {
    return {
      status: "SENT_TO_LOYVERSE" as const,
      loyverseReceiptId: result.receiptId,
      loyverseSyncError: null,
    };
  }

  return {
    status: "FAILED_TO_SEND" as const,
    loyverseReceiptId: null,
    loyverseSyncError: result.error,
  };
}

/**
 * Sync policy: transmit to Loyverse immediately after customer order creation.
 * Admin retry endpoint is used for manual resend of failed orders.
 */
export async function createLoyversePickupOrder(
  input: CreateLoyversePickupOrderInput
): Promise<LoyverseOrderResult> {
  const accessToken = process.env.LOYVERSE_API_TOKEN?.trim();
  const storeId = process.env.LOYVERSE_STORE_ID?.trim();

  if (!accessToken) {
    return buildFailure("CONFIG_ERROR", "LOYVERSE_API_TOKEN is not configured");
  }

  if (!storeId) {
    return buildFailure("CONFIG_ERROR", "LOYVERSE_STORE_ID is not configured");
  }

  const missingItemMappings = input.items.reduce(
    (count, item) => count + (normalizeString(item.itemId).length === 0 ? 1 : 0),
    0
  );
  if (missingItemMappings > 0) {
    return buildFailure(
      "MISSING_REQUIRED_MAPPING",
      `Missing Loyverse item mapping for ${missingItemMappings} line item(s)`
    );
  }

  const missingModifierMappings = input.items.reduce(
    (count, item) =>
      count +
      item.modifiers.reduce(
        (itemCount, modifier) => itemCount + (normalizeString(modifier.modifierId).length === 0 ? 1 : 0),
        0
      ),
    0
  );
  if (missingModifierMappings > 0) {
    return buildFailure(
      "MISSING_REQUIRED_MAPPING",
      `Missing Loyverse modifier mapping for ${missingModifierMappings} line modifier(s)`
    );
  }

  try {
    const variantIdByItemId = await resolveVariantIdByItemId(
      input.items
        .map((item) => item.itemId)
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
      accessToken
    );
    const paymentType = await fetchDefaultPaymentType(accessToken);
    if (!paymentType) {
      return buildFailure("CONFIG_ERROR", "No active Loyverse payment type is available");
    }
    const payload = mapCartToLoyversePayload(input, storeId, paymentType.id, variantIdByItemId);

    const response = await fetch(`${LOYVERSE_API_BASE}/receipts`, {
      method: "POST",
      headers: {
        Authorization: ["Bearer", accessToken].join(" "),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      const parsedError = await parseLoyverseErrorResponse(response);
      return buildFailure("HTTP_ERROR", `status ${response.status} - ${parsedError}`);
    }

    let responsePayload: unknown;
    try {
      responsePayload = await response.json();
    } catch {
      return buildFailure("RESPONSE_PARSE_ERROR", "Loyverse success response is not valid JSON");
    }

    const receiptId = extractReceiptId(responsePayload);
    if (!receiptId) {
      return buildFailure("RESPONSE_PARSE_ERROR", "Receipt ID missing in Loyverse response");
    }

    return {
      success: true,
      receiptId,
    };
  } catch (error) {
    if (error instanceof Error) {
      return buildFailure("NETWORK_ERROR", error.message);
    }
    return buildFailure("NETWORK_ERROR", "Unknown network error");
  }
}
