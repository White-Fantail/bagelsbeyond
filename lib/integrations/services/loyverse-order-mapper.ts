// ─── Loyverse Order Payload Mapper ────────────────────────────────────────────
// Translates internal order data into a Loyverse-ready receipt payload.
//
// Rules:
//   - Internal DB ids (cuid) must NEVER appear in the output payload.
//   - All product / modifier group / modifier option fields must use Loyverse ids.
//   - Throws a descriptive error if any required Loyverse id is missing so that
//     callers can fail early rather than send a broken payload.
//
// Usage:
//   import { buildLoyverseReceiptPayload } from "./loyverse-order-mapper";
//
//   const payload = buildLoyverseReceiptPayload(order, productMappings, optionMappings);
//   // payload contains only Loyverse ids — safe to POST to /receipts

// ─── Input types ─────────────────────────────────────────────────────────────

export interface OrderItemOptionInput {
  /** Internal DB id of the ProductOption — used only for lookup; never sent to Loyverse. */
  internalOptionId: string | null;
  /** Display name snapshot from the order. Used as fallback if no mapping name is available. */
  optionNameSnapshot: string;
  priceDeltaSnapshot: number;
  quantity: number;
}

export interface OrderItemInput {
  /** Internal DB id of the Product — used only for lookup; never sent to Loyverse. */
  internalProductId: string | null;
  productNameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
  lineTotal: number;
  options: OrderItemOptionInput[];
}

export interface OrderInput {
  orderNumber: string;
  source: string | null;
  totalAmount: number;
  createdAt: Date;
  note: string | null;
  items: OrderItemInput[];
}

// ─── Resolved mapping types ───────────────────────────────────────────────────

/** Resolved Loyverse product mapping (from ExternalProductMap). */
export interface ResolvedProductMapping {
  /** Internal DB Product.id */
  internalProductId: string;
  /** Loyverse item id */
  loyverseProductId: string;
}

/** Resolved Loyverse modifier option mapping (from ExternalOptionMap). */
export interface ResolvedOptionMapping {
  /** Internal DB ProductOption.id */
  internalOptionId: string;
  /** Loyverse modifier option id */
  loyverseOptionId: string;
  /** Loyverse modifier group id (modifier_set_id) */
  loyverseGroupId: string | null;
  /** Display name from Loyverse (may differ from internal snapshot) */
  externalName: string | null;
}

// ─── Output types (Loyverse receipt payload) ─────────────────────────────────

export interface LoyverseModifierPayload {
  /** Loyverse modifier option id — MUST be a Loyverse id, never an internal id. */
  modifier_option_id: string;
  price: number;
}

export interface LoyverseLineItemPayload {
  /** Loyverse variant id (null for unmapped internal-only products). */
  variant_id: string | null;
  quantity: number;
  price: number;
  line_modifiers: LoyverseModifierPayload[];
}

export interface LoyverseReceiptPayload {
  order: string;
  note: string | null;
  line_items: LoyverseLineItemPayload[];
  receipt_date: string;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

/**
 * Build a Loyverse receipt payload from internal order data and pre-resolved mappings.
 *
 * This function does NOT perform any database lookups — callers must supply
 * `productMappings` and `optionMappings` resolved from the database beforehand.
 *
 * @throws {Error} if a required Loyverse id is missing for any modifier option.
 *
 * Internal ids are accepted only for lookup; they are never written to the output.
 */
export function buildLoyverseReceiptPayload(
  order: OrderInput,
  productMappings: ResolvedProductMapping[],
  optionMappings: ResolvedOptionMapping[]
): LoyverseReceiptPayload {
  const productMapById = new Map(
    productMappings.map((m) => [m.internalProductId, m.loyverseProductId])
  );
  const optionMapById = new Map(
    optionMappings.map((m) => [m.internalOptionId, m])
  );

  const notePrefix = order.source ? `[${order.source}]` : "";
  const noteBody = order.note ?? "";
  const note = [notePrefix, noteBody].filter(Boolean).join(" ") || null;

  const line_items: LoyverseLineItemPayload[] = order.items.map((item) => {
    const loyverseProductId = item.internalProductId
      ? (productMapById.get(item.internalProductId) ?? null)
      : null;

    const modifiers: LoyverseModifierPayload[] = item.options.map((opt) => {
      if (!opt.internalOptionId) {
        throw new Error(
          `Modifier option mapping missing: option has no internalOptionId (snapshot: "${opt.optionNameSnapshot}")`
        );
      }

      const mapping = optionMapById.get(opt.internalOptionId);
      if (!mapping) {
        throw new Error(
          `Modifier option mapping missing for internal option ${opt.internalOptionId} ("${opt.optionNameSnapshot}")`
        );
      }

      const result: LoyverseModifierPayload = {
        modifier_option_id: mapping.loyverseOptionId,
        price: opt.priceDeltaSnapshot,
      };
      return result;
    });

    return {
      variant_id: loyverseProductId,
      quantity: item.quantity,
      price: item.unitPriceSnapshot,
      line_modifiers: modifiers,
    };
  });

  return {
    order: order.orderNumber,
    note,
    line_items,
    receipt_date: order.createdAt.toISOString(),
  };
}
