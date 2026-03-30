// Cart types used by localStorage-based client cart.
// These are snapshot/display types only.
// Server re-validates all prices at checkout — never trust client values.

export interface SelectedOption {
  optionGroupId: string;
  optionGroupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface CartItem {
  /** Unique cart entry ID (client-generated) */
  id: string;
  itemId: string;
  itemName: string;
  basePrice: number;
  quantity: number;
  selectedOptions: SelectedOption[];
  /** Client-side estimated line total (server will recalculate) */
  lineTotal: number;
}
