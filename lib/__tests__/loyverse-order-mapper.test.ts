// ─── Loyverse Order Mapper Tests ──────────────────────────────────────────────
// Validates that buildLoyverseReceiptPayload:
//   - Uses only Loyverse ids in the output — never internal DB ids.
//   - Correctly maps modifiers (modifier_id / modifier_set_id).
//   - Fails fast with a clear error for missing Loyverse mappings.

import { describe, it, expect } from "vitest";
import {
  buildLoyverseReceiptPayload,
  type OrderInput,
  type ResolvedProductMapping,
  type ResolvedOptionMapping,
} from "../integrations/services/loyverse-order-mapper";

// ─── Test fixtures ────────────────────────────────────────────────────────────

const INTERNAL_PRODUCT_ID = "cmn8hazc00087i1jj4shv3gox";
const LOYVERSE_PRODUCT_ID = "lv-item-001";

const INTERNAL_GROUP_ID = "cmn8hazc00088i1jj4shv3goy";
const LOYVERSE_GROUP_ID = "lv-mod-group-001";

const INTERNAL_OPTION_ID_1 = "cmn8hazc00089i1jj4shv3goz";
const LOYVERSE_OPTION_ID_1 = "lv-mod-opt-001";

const INTERNAL_OPTION_ID_2 = "cmn8hazc00090i1jj4shv3goa";
const LOYVERSE_OPTION_ID_2 = "lv-mod-opt-002";

function makeOrder(items: OrderInput["items"]): OrderInput {
  return {
    orderNumber: "ORD-001",
    source: "INTERNAL",
    totalAmount: 10.0,
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    note: null,
    items,
  };
}

function makeProductMapping(
  internalProductId = INTERNAL_PRODUCT_ID,
  loyverseProductId = LOYVERSE_PRODUCT_ID
): ResolvedProductMapping {
  return { internalProductId, loyverseProductId };
}

function makeOptionMapping(
  internalOptionId: string,
  loyverseOptionId: string,
  loyverseGroupId: string | null = LOYVERSE_GROUP_ID
): ResolvedOptionMapping {
  return {
    internalOptionId,
    loyverseOptionId,
    loyverseGroupId,
    externalName: null,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("buildLoyverseReceiptPayload", () => {
  // ── product without modifiers ──────────────────────────────────────────────

  it("maps a product without modifiers correctly", () => {
    const order = makeOrder([
      {
        internalProductId: INTERNAL_PRODUCT_ID,
        productNameSnapshot: "Classic Bagel",
        unitPriceSnapshot: 4.5,
        quantity: 2,
        lineTotal: 9.0,
        options: [],
      },
    ]);

    const payload = buildLoyverseReceiptPayload(
      order,
      [makeProductMapping()],
      []
    );

    expect(payload.receipt_number).toBe("ORD-001");
    expect(payload.total_money).toBe(10.0);
    expect(payload.line_items).toHaveLength(1);

    const lineItem = payload.line_items[0];
    expect(lineItem.item_id).toBe(LOYVERSE_PRODUCT_ID);
    expect(lineItem.item_name).toBe("Classic Bagel");
    expect(lineItem.quantity).toBe(2);
    expect(lineItem.modifiers).toHaveLength(0);
  });

  // ── product with one modifier group and one option ─────────────────────────

  it("maps a product with one modifier group and one option", () => {
    const order = makeOrder([
      {
        internalProductId: INTERNAL_PRODUCT_ID,
        productNameSnapshot: "Classic Bagel",
        unitPriceSnapshot: 4.5,
        quantity: 1,
        lineTotal: 4.5,
        options: [
          {
            internalOptionId: INTERNAL_OPTION_ID_1,
            optionNameSnapshot: "Plain",
            priceDeltaSnapshot: 0,
            quantity: 1,
          },
        ],
      },
    ]);

    const payload = buildLoyverseReceiptPayload(
      order,
      [makeProductMapping()],
      [makeOptionMapping(INTERNAL_OPTION_ID_1, LOYVERSE_OPTION_ID_1)]
    );

    const lineItem = payload.line_items[0];
    expect(lineItem.item_id).toBe(LOYVERSE_PRODUCT_ID);
    expect(lineItem.modifiers).toHaveLength(1);

    const modifier = lineItem.modifiers[0];
    expect(modifier.modifier_id).toBe(LOYVERSE_OPTION_ID_1);
    expect(modifier.modifier_set_id).toBe(LOYVERSE_GROUP_ID);
    expect(modifier.name).toBe("Plain");
    expect(modifier.price).toBe(0);
  });

  // ── product with multiple modifier groups/options ──────────────────────────

  it("maps a product with multiple modifier options", () => {
    const INTERNAL_GROUP_ID_2 = "cmn8hazc00091i1jj4shv3gob";
    const LOYVERSE_GROUP_ID_2 = "lv-mod-group-002";

    const order = makeOrder([
      {
        internalProductId: INTERNAL_PRODUCT_ID,
        productNameSnapshot: "Bagel Sandwich",
        unitPriceSnapshot: 7.5,
        quantity: 1,
        lineTotal: 8.3,
        options: [
          {
            internalOptionId: INTERNAL_OPTION_ID_1,
            optionNameSnapshot: "Sesame",
            priceDeltaSnapshot: 0,
            quantity: 1,
          },
          {
            internalOptionId: INTERNAL_OPTION_ID_2,
            optionNameSnapshot: "Oat Milk",
            priceDeltaSnapshot: 0.8,
            quantity: 1,
          },
        ],
      },
    ]);

    const payload = buildLoyverseReceiptPayload(
      order,
      [makeProductMapping()],
      [
        makeOptionMapping(INTERNAL_OPTION_ID_1, LOYVERSE_OPTION_ID_1, LOYVERSE_GROUP_ID),
        makeOptionMapping(INTERNAL_OPTION_ID_2, LOYVERSE_OPTION_ID_2, LOYVERSE_GROUP_ID_2),
      ]
    );

    const modifiers = payload.line_items[0].modifiers;
    expect(modifiers).toHaveLength(2);
    expect(modifiers[0].modifier_id).toBe(LOYVERSE_OPTION_ID_1);
    expect(modifiers[0].modifier_set_id).toBe(LOYVERSE_GROUP_ID);
    expect(modifiers[1].modifier_id).toBe(LOYVERSE_OPTION_ID_2);
    expect(modifiers[1].modifier_set_id).toBe(LOYVERSE_GROUP_ID_2);
  });

  // ── missing loyverse product id ────────────────────────────────────────────

  it("sends item_id as null when loyverse product mapping is missing", () => {
    const order = makeOrder([
      {
        internalProductId: "some-unmapped-internal-id",
        productNameSnapshot: "Internal-only Product",
        unitPriceSnapshot: 5.0,
        quantity: 1,
        lineTotal: 5.0,
        options: [],
      },
    ]);

    // No product mapping provided — item_id should be null (not the internal id)
    const payload = buildLoyverseReceiptPayload(order, [], []);

    expect(payload.line_items[0].item_id).toBeNull();
  });

  // ── missing loyverse modifier option id ───────────────────────────────────

  it("throws a descriptive error when loyverse modifier option mapping is missing", () => {
    const order = makeOrder([
      {
        internalProductId: INTERNAL_PRODUCT_ID,
        productNameSnapshot: "Classic Bagel",
        unitPriceSnapshot: 4.5,
        quantity: 1,
        lineTotal: 4.5,
        options: [
          {
            internalOptionId: INTERNAL_OPTION_ID_1,
            optionNameSnapshot: "Plain",
            priceDeltaSnapshot: 0,
            quantity: 1,
          },
        ],
      },
    ]);

    // Option mapping not provided
    expect(() =>
      buildLoyverseReceiptPayload(order, [makeProductMapping()], [])
    ).toThrow(`Modifier option mapping missing for internal option ${INTERNAL_OPTION_ID_1}`);
  });

  // ── missing loyverse modifier group id ────────────────────────────────────

  it("omits modifier_set_id when loyverse group id is null", () => {
    const order = makeOrder([
      {
        internalProductId: INTERNAL_PRODUCT_ID,
        productNameSnapshot: "Classic Bagel",
        unitPriceSnapshot: 4.5,
        quantity: 1,
        lineTotal: 4.5,
        options: [
          {
            internalOptionId: INTERNAL_OPTION_ID_1,
            optionNameSnapshot: "Plain",
            priceDeltaSnapshot: 0,
            quantity: 1,
          },
        ],
      },
    ]);

    // Mapping has no group id
    const payload = buildLoyverseReceiptPayload(
      order,
      [makeProductMapping()],
      [makeOptionMapping(INTERNAL_OPTION_ID_1, LOYVERSE_OPTION_ID_1, null)]
    );

    const modifier = payload.line_items[0].modifiers[0];
    expect(modifier.modifier_id).toBe(LOYVERSE_OPTION_ID_1);
    expect(modifier.modifier_set_id).toBeUndefined();
  });

  // ── throws when option has null internalOptionId ──────────────────────────

  it("throws a descriptive error when option has no internalOptionId", () => {
    const order = makeOrder([
      {
        internalProductId: INTERNAL_PRODUCT_ID,
        productNameSnapshot: "Classic Bagel",
        unitPriceSnapshot: 4.5,
        quantity: 1,
        lineTotal: 4.5,
        options: [
          {
            internalOptionId: null,
            optionNameSnapshot: "Plain",
            priceDeltaSnapshot: 0,
            quantity: 1,
          },
        ],
      },
    ]);

    expect(() =>
      buildLoyverseReceiptPayload(order, [makeProductMapping()], [])
    ).toThrow('Modifier option mapping missing: option has no internalOptionId');
  });

  // ── no internal ids in outgoing payload ───────────────────────────────────

  it("never leaks internal DB ids into the outgoing Loyverse payload", () => {
    const order = makeOrder([
      {
        internalProductId: INTERNAL_PRODUCT_ID,
        productNameSnapshot: "Classic Bagel",
        unitPriceSnapshot: 4.5,
        quantity: 1,
        lineTotal: 4.5,
        options: [
          {
            internalOptionId: INTERNAL_OPTION_ID_1,
            optionNameSnapshot: "Sesame",
            priceDeltaSnapshot: 0,
            quantity: 1,
          },
        ],
      },
    ]);

    const payload = buildLoyverseReceiptPayload(
      order,
      [makeProductMapping()],
      [makeOptionMapping(INTERNAL_OPTION_ID_1, LOYVERSE_OPTION_ID_1)]
    );

    const serialized = JSON.stringify(payload);

    // The internal cuid-style ids must not appear anywhere in the final payload
    expect(serialized).not.toContain(INTERNAL_PRODUCT_ID);
    expect(serialized).not.toContain(INTERNAL_OPTION_ID_1);
    expect(serialized).not.toContain(INTERNAL_GROUP_ID);

    // But Loyverse ids should be present
    expect(serialized).toContain(LOYVERSE_PRODUCT_ID);
    expect(serialized).toContain(LOYVERSE_OPTION_ID_1);
    expect(serialized).toContain(LOYVERSE_GROUP_ID);
  });

  // ── note building ─────────────────────────────────────────────────────────

  it("builds the note with source prefix when source is set", () => {
    const order: OrderInput = {
      ...makeOrder([]),
      source: "INTERNAL",
      note: "Extra sesame seeds please",
    };

    const payload = buildLoyverseReceiptPayload(order, [], []);
    expect(payload.note).toBe("[INTERNAL] Extra sesame seeds please");
  });

  it("sets note to null when source and note are both absent", () => {
    const order: OrderInput = { ...makeOrder([]), source: null, note: null };
    const payload = buildLoyverseReceiptPayload(order, [], []);
    expect(payload.note).toBeNull();
  });

  // ── created_at ISO string ─────────────────────────────────────────────────

  it("formats created_at as ISO string", () => {
    const date = new Date("2026-06-15T08:30:00.000Z");
    const order: OrderInput = { ...makeOrder([]), createdAt: date };
    const payload = buildLoyverseReceiptPayload(order, [], []);
    expect(payload.created_at).toBe("2026-06-15T08:30:00.000Z");
  });
});
