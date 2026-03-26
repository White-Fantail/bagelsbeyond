// ─── POS Adapter Types ────────────────────────────────────────────────────────
// Shared interface contract for all external POS systems.
// Each POS adapter (Loyverse, Square, etc.) implements POSAdapter.

export interface ExternalProduct {
  externalId: string;
  name: string;
  price: number;
  category?: string;
  isActive: boolean;
}

export interface ExternalOrderItem {
  externalProductId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
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
