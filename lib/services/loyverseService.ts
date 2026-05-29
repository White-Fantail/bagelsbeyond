import "server-only";

/**
 * Loyverse Integration Service
 *
 * IMPORTANT: Loyverse's public API does not support creating open/unpaid receipts directly.
 * The available options are:
 *
 * Option A (Current Implementation): Skip Loyverse receipt creation entirely.
 *   Orders are stored locally in CustomerOrder with status PENDING.
 *   Staff manually enter the order in Loyverse POS when the customer picks up.
 *   This is the safest approach for now.
 *
 * Option B (Future): Use Loyverse Receipts API to create a completed receipt
 *   when staff confirm payment at POS pickup. Requires LOYVERSE_ACCESS_TOKEN.
 *   Endpoint: POST https://api.loyverse.com/v1.0/receipts
 *
 * Option C (Future): Integrate Loyverse Open Ticket API if available on the plan.
 *
 * TODO: When Loyverse API integration is ready, implement createPickupReceipt()
 * using the Loyverse Receipts API with the store's access token.
 *
 * Required env vars (when implementing B/C):
 *   LOYVERSE_ACCESS_TOKEN=your_token_here
 *   LOYVERSE_STORE_ID=your_store_id_here
 */

export type LoyverseOrderResult = {
  success: boolean;
  receiptId?: string;
  error?: string;
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

/**
 * Maps cart items to Loyverse receipt line items format.
 * Currently returns a stub payload for future use.
 */
export function mapCartToLoyversePayload(input: CreateLoyversePickupOrderInput) {
  // TODO: Map to actual Loyverse Receipts API format when implementing integration
  return {
    order_number: input.orderNumber,
    customer_name: input.customerName,
    items: input.items.map((item) => ({
      item_name: item.itemNameSnapshot,
      quantity: item.quantity,
      price: item.unitPrice,
      modifiers: item.modifiers,
    })),
    total_money: {
      amount: Math.round(input.total * 100),
      currency_code: "NZD",
    },
    note: input.notes ?? undefined,
  };
}

/**
 * Attempts to create a pickup order in Loyverse.
 *
 * Currently: Returns a stub success without calling Loyverse API.
 * See file-level comment for future implementation options.
 */
export async function createLoyversePickupOrder(
  input: CreateLoyversePickupOrderInput
): Promise<LoyverseOrderResult> {
  const accessToken = process.env.LOYVERSE_ACCESS_TOKEN;
  
  if (!accessToken) {
    // No token configured — skip Loyverse sync, order stays PENDING
    // Staff will manually handle in POS
    return {
      success: false,
      error: "LOYVERSE_ACCESS_TOKEN not configured. Order saved locally. Staff to process manually.",
    };
  }

  // TODO: Implement actual Loyverse API call when token is available
  // const payload = mapCartToLoyversePayload(input);
  // const response = await fetch("https://api.loyverse.com/v1.0/receipts", {
  //   method: "POST",
  //   headers: {
  //     "Authorization": `******  // accessToken from LOYVERSE_ACCESS_TOKEN env var
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify(payload),
  // });
  // if (!response.ok) {
  //   const err = await response.text();
  //   return { success: false, error: err };
  // }
  // const data = await response.json();
  // return { success: true, receiptId: data.id };

  return {
    success: false,
    error: "Loyverse integration not yet implemented. Order saved locally.",
  };
}
