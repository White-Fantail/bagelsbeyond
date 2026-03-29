// Cart types used by localStorage-based client cart.
// These are snapshot/display types only.
// Server re-validates all prices at checkout — never trust client values.
//
// ID conventions:
//   optionGroupId / optionId / productId — internal DB ids (cuid).
//   These are used ONLY for local UI state and server-side validation lookups.
//   They must NEVER be forwarded to external systems (e.g. Loyverse).
//   The server resolves the corresponding Loyverse ids via ExternalOptionMap /
//   ExternalProductMap before building any external payload.

export interface SelectedOption {
  /** Internal DB id of ProductOptionGroup — for server lookup only, not for Loyverse. */
  optionGroupId: string;
  optionGroupName: string;
  /** Internal DB id of ProductOption — for server lookup only, not for Loyverse. */
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface CartItem {
  /** Unique cart entry ID (client-generated) */
  id: string;
  /** Internal DB id of Product — for server lookup only, not for Loyverse. */
  productId: string;
  productName: string;
  basePrice: number;
  quantity: number;
  selectedOptions: SelectedOption[];
  /** Client-side estimated line total (server will recalculate) */
  lineTotal: number;
}
