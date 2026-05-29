import "server-only";

const LOYVERSE_API_BASE = "https://api.loyverse.com/v1.0";
const DEFAULT_CURRENCY_CODE = "NZD";

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
    item_name: string;
    quantity: number;
    price: number;
    line_modifiers?: Array<{
      name: string;
      price: number;
    }>;
  }>;
  total_money: {
    amount: number;
    currency_code: string;
  };
  note?: string;
};

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

function buildOrderNote(input: CreateLoyversePickupOrderInput): string {
  const noteParts = [
    `Customer: ${input.customerName} (${input.customerPhone})`,
    `Pickup: ${input.pickupType}${input.pickupTime ? ` @ ${input.pickupTime.toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" })}` : ""}`,
    input.notes?.trim() ? `Note: ${input.notes.trim()}` : "",
  ].filter(Boolean);

  return noteParts.join(" | ");
}

function mapLineItems(items: CartItemForLoyverse[]): LoyverseReceiptPayload["line_items"] {
  return items.map((item) => ({
    item_id: item.itemId ?? undefined,
    item_name: item.itemNameSnapshot,
    quantity: item.quantity,
    price: toMoneyAmount(item.unitPrice),
    line_modifiers:
      item.modifiers.length > 0
        ? item.modifiers.map((modifier) => ({
            name: `${modifier.modifierGroupName}: ${modifier.modifierOptionName}`,
            price: toMoneyAmount(modifier.priceDelta),
          }))
        : undefined,
  }));
}

export function mapCartToLoyversePayload(
  input: CreateLoyversePickupOrderInput,
  storeId: string
): LoyverseReceiptPayload {
  return {
    store_id: storeId,
    receipt_number: input.orderNumber,
    line_items: mapLineItems(input.items),
    total_money: {
      amount: toMoneyAmount(input.total),
      currency_code: DEFAULT_CURRENCY_CODE,
    },
    note: buildOrderNote(input),
  };
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

  const payload = mapCartToLoyversePayload(input, storeId);

  try {
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
