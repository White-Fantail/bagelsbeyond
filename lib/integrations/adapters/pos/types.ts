// ─── POS Adapter Types ────────────────────────────────────────────────────────
// Shared interface contract for all external POS systems.
// Each POS adapter (Loyverse, Square, etc.) implements POSAdapter.

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
  modifiers_ids: string[];
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
 * Docs: https://developer.loyverse.com/docs/#tag/Modifiers
 */
export interface LoyverseRawModifier {
  id: string;
  name: string;
  /** Selectable options within this modifier (e.g. milk choices, toppings).
   * The Loyverse API may omit this field for modifiers with no options. */
  options?: LoyverseRawModifierOption[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Full normalised catalogue from Loyverse (raw + cross-referenced) */
export interface LoyverseCatalogRaw {
  items: LoyverseRawItem[];
  categories: LoyverseRawCategory[];
  /** Loyverse modifiers — each corresponds to a modifier group in internal models */
  modifiers: LoyverseRawModifier[];
}

// ─── Normalised External Types (POS-agnostic) ────────────────────────────────
// These are the canonical types used by catalog-sync and catalog-mapper.

export interface ExternalModifier {
  externalId: string;
  name: string;
  priceDelta: number;
}

export interface ExternalModifierGroup {
  externalId: string;
  name: string;
  modifiers: ExternalModifier[];
}

export interface ExternalProduct {
  externalId: string;
  name: string;
  description?: string;
  /** SKU / reference code from the external system, if available */
  sku?: string;
  price: number;
  category?: string;
  isActive: boolean;
  modifierGroups?: ExternalModifierGroup[];
  updatedAt?: string;
}

export interface ExternalOrderItemModifier {
  name: string;
  price: number;
  quantity?: number;
}

export interface ExternalOrderItem {
  externalProductId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** Optional modifiers/options attached to this line item (e.g. Oat Milk +$0.80) */
  modifiers?: ExternalOrderItemModifier[];
}

export interface ExternalOrder {
  externalId: string;
  orderNumber?: string;
  items: ExternalOrderItem[];
  totalAmount: number;
  createdAt: Date;
  note?: string;
}

export interface SyncResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface POSAdapter {
  /** Fetch the full product catalogue from the external POS. */
  fetchExternalCatalog(): Promise<SyncResult<ExternalProduct[]>>;

  /** Push an internal order to the external POS. */
  pushOrderToExternalPos(order: ExternalOrder): Promise<SyncResult<{ externalOrderId: string }>>;

  /** Sync inventory levels from the external POS for a given date. */
  syncInventoryFromExternal(date: Date): Promise<SyncResult<Record<string, number>>>;
}

/** Map a single ExternalProduct to the shape expected by Product upsert logic. */
export function mapExternalProductToInternal(
  ext: ExternalProduct
): { name: string; basePrice: number; isActive: boolean } {
  return {
    name: ext.name,
    basePrice: ext.price,
    isActive: ext.isActive,
  };
}
