// ─── POS Adapter Types ────────────────────────────────────────────────────────
// Shared raw API types for external POS systems.
// Internal canonical types (Category, Item, etc.) are in prisma/schema.prisma.

// ─── Loyverse Raw API Types ───────────────────────────────────────────────────
// These reflect the actual Loyverse REST API v1.0 response shapes.
// https://developer.loyverse.com/docs/
// Do NOT mix these with internal Product types.

export interface LoyverseRawVariant {
  variant_id: string;
  item_id: string;
  sku: string | null;
  reference_id: string | null;
  barcode: string | null;
  cost: number | null;
  default_pricing_type: "FIXED" | "VARIABLE";
  default_price: number | null;
  stores: Array<{
    store_id: string;
    pricing_type: "FIXED" | "VARIABLE";
    price: number | null;
    available_for_sale: boolean;
  }>;
  option1_name: string | null;
  option1_val: string | null;
  option2_name: string | null;
  option2_val: string | null;
  option3_name: string | null;
  option3_val: string | null;
  updated_at?: string;
}

export interface LoyverseRawItem {
  id: string;
  item_name: string;
  description: string | null;
  reference_id: string | null;
  category_id: string | null;
  sold_by_weight: boolean;
  is_composite: boolean;
  /** IDs of modifier groups attached to this item */
  modifier_ids: string[];
  form: string;
  image_url: string | null;
  color: string | null;
  variants: LoyverseRawVariant[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface LoyverseRawCategory {
  id: string;
  name: string;
  color: string | null;
  deleted_at: string | null;
}

/** One selectable option within a Loyverse modifier (e.g. "Oat Milk", price: 0.80) */
export interface LoyverseRawModifierOption {
  id: string;
  name: string;
  price: number;
}

/**
 * A Loyverse "modifier" — equivalent to a modifier *group* in other systems.
 * Each modifier has a name and a list of selectable options.
 * Retrieved from GET /modifiers.
 */
export interface LoyverseRawModifier {
  id: string;
  name: string;
  min_select?: number | null;
  max_select?: number | null;
  required?: boolean;
  options?: LoyverseRawModifierOption[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Inventory level for a variant at a specific store, from GET /inventory. */
export interface LoyverseRawInventoryLevel {
  variant_id: string;
  store_id: string;
  in_stock: number | null;
  updated_at: string;
}

/** Full normalised catalogue from Loyverse (raw + cross-referenced) */
export interface LoyverseCatalogRaw {
  items: LoyverseRawItem[];
  categories: LoyverseRawCategory[];
  /** Loyverse modifiers — each corresponds to a modifier group in internal models */
  modifiers: LoyverseRawModifier[];
}

/** Loyverse raw payment type */
export interface LoyverseRawPaymentType {
  id: string;
  name: string;
  type: string | null;
  stores: Array<{ store_id: string }>;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

/** Loyverse raw receipt line item modifier */
export interface LoyverseRawReceiptModifier {
  modifier_option_id: string | null;
  name: string | null;
  price: number | null;
}

/** Loyverse raw receipt line item */
export interface LoyverseRawReceiptLineItem {
  variant_id: string | null;
  item_name: string | null;
  quantity: number;
  price: number | null;
  cost: number | null;
  note: string | null;
  modifiers?: LoyverseRawReceiptModifier[];
}

/** Loyverse raw receipt payment */
export interface LoyverseRawReceiptPayment {
  payment_type_id: string | null;
  name: string | null;
  money_amount: number | null;
  paid_at: string | null;
}

/** Loyverse raw receipt */
export interface LoyverseRawReceipt {
  id: string | null;
  receipt_number: string | null;
  store_id: string | null;
  customer_id: string | null;
  source: string | null;
  receipt_date: string | null;
  note: string | null;
  line_items?: LoyverseRawReceiptLineItem[];
  payments?: LoyverseRawReceiptPayment[];
}

/** Generic sync result wrapper */
export interface SyncResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
