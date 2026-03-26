// ─── Catalog Mapper Tests ─────────────────────────────────────────────────────
import { describe, it, expect } from "vitest";
import {
  normalizeLoyverseCatalog,
  mapExternalCategory,
  buildSyncedProductFields,
} from "../integrations/services/catalog-mapper";
import type { LoyverseCatalogRaw, ExternalProduct } from "../integrations/adapters/pos/types";
import { ProductCategory } from "@/app/generated/prisma/enums";

// ─── mapExternalCategory ──────────────────────────────────────────────────────

describe("mapExternalCategory", () => {
  it("returns BAGEL for 'Bagels'", () => {
    expect(mapExternalCategory("Bagels")).toBe(ProductCategory.BAGEL);
  });
  it("returns BAGEL for 'fresh bagel'", () => {
    expect(mapExternalCategory("fresh bagel")).toBe(ProductCategory.BAGEL);
  });

  it("returns SANDWICH for 'Sandwiches'", () => {
    expect(mapExternalCategory("Sandwiches")).toBe(ProductCategory.SANDWICH);
  });
  it("returns SANDWICH for 'Wrap'", () => {
    expect(mapExternalCategory("Wrap")).toBe(ProductCategory.SANDWICH);
  });
  it("returns SANDWICH for 'Sub'", () => {
    expect(mapExternalCategory("Sub")).toBe(ProductCategory.SANDWICH);
  });
  it("returns SANDWICH for 'Panini'", () => {
    expect(mapExternalCategory("Panini")).toBe(ProductCategory.SANDWICH);
  });

  it("returns SPREAD for 'Spreads'", () => {
    expect(mapExternalCategory("Spreads")).toBe(ProductCategory.SPREAD);
  });
  it("returns SPREAD for 'cream cheese'", () => {
    expect(mapExternalCategory("cream cheese")).toBe(ProductCategory.SPREAD);
  });

  it("returns DRINK for 'Drinks'", () => {
    expect(mapExternalCategory("Drinks")).toBe(ProductCategory.DRINK);
  });
  it("returns DRINK for 'Coffee'", () => {
    expect(mapExternalCategory("Coffee")).toBe(ProductCategory.DRINK);
  });
  it("returns DRINK for 'Tea'", () => {
    expect(mapExternalCategory("Tea")).toBe(ProductCategory.DRINK);
  });
  it("returns DRINK for 'Fresh Juice'", () => {
    expect(mapExternalCategory("Fresh Juice")).toBe(ProductCategory.DRINK);
  });
  it("returns DRINK for 'Sparkling Water'", () => {
    expect(mapExternalCategory("Sparkling Water")).toBe(ProductCategory.DRINK);
  });

  it("returns OTHER for unknown category", () => {
    expect(mapExternalCategory("Snacks")).toBe(ProductCategory.OTHER);
  });
  it("returns OTHER for empty string", () => {
    expect(mapExternalCategory("")).toBe(ProductCategory.OTHER);
  });
  it("returns OTHER for undefined", () => {
    expect(mapExternalCategory(undefined)).toBe(ProductCategory.OTHER);
  });
});

// ─── buildSyncedProductFields ─────────────────────────────────────────────────

describe("buildSyncedProductFields", () => {
  it("maps all overwritable fields correctly", () => {
    const ext: ExternalProduct = {
      externalId: "ext-001",
      name: "Classic Bagel",
      description: "A fresh bagel",
      price: 4.5,
      isActive: true,
      category: "Bagels",
    };
    const fields = buildSyncedProductFields(ext);
    expect(fields).toEqual({
      name: "Classic Bagel",
      description: "A fresh bagel",
      basePrice: 4.5,
      isActive: true,
      category: ProductCategory.BAGEL,
    });
  });

  it("sets description to null when absent", () => {
    const ext: ExternalProduct = {
      externalId: "ext-002",
      name: "Plain Bagel",
      price: 3.0,
      isActive: true,
    };
    const fields = buildSyncedProductFields(ext);
    expect(fields.description).toBeNull();
  });

  it("falls back to OTHER when category is undefined", () => {
    const ext: ExternalProduct = {
      externalId: "ext-003",
      name: "Mystery Item",
      price: 2.0,
      isActive: false,
    };
    const fields = buildSyncedProductFields(ext);
    expect(fields.category).toBe(ProductCategory.OTHER);
  });
});

// ─── normalizeLoyverseCatalog ─────────────────────────────────────────────────

const MOCK_CATALOG: LoyverseCatalogRaw = {
  items: [
    {
      id: "item-001",
      item_name: "Classic Bagel",
      description: "Plain bagel",
      reference_id: "SKU-001",
      category_id: "cat-001",
      sold_by_weight: false,
      is_composite: false,
      modifiers_ids: ["mod-group-001"],
      form: "FORM_ITEM",
      image_url: null,
      color: null,
      variants: [
        {
          variant_id: "var-001",
          item_id: "item-001",
          sku: "SKU-001",
          reference_id: null,
          barcode: null,
          cost: 1.5,
          default_pricing_type: "FIXED",
          default_price: 4.5,
          stores: [
            { store_id: "store-001", pricing_type: "FIXED", price: 4.5, available_for_sale: true },
          ],
          option1_name: null,
          option1_val: null,
          option2_name: null,
          option2_val: null,
          option3_name: null,
          option3_val: null,
        },
      ],
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-06-01T00:00:00.000Z",
      deleted_at: null,
    },
    {
      id: "item-002",
      item_name: "Deleted Item",
      description: null,
      reference_id: null,
      category_id: null,
      sold_by_weight: false,
      is_composite: false,
      modifiers_ids: [],
      form: "FORM_ITEM",
      image_url: null,
      color: null,
      variants: [],
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-06-01T00:00:00.000Z",
      deleted_at: "2024-03-01T00:00:00.000Z",
    },
    {
      id: "item-003",
      item_name: "Flat White",
      description: null,
      reference_id: null,
      category_id: "cat-002",
      sold_by_weight: false,
      is_composite: false,
      modifiers_ids: ["mod-group-002"],
      form: "FORM_ITEM",
      image_url: null,
      color: null,
      variants: [
        {
          variant_id: "var-003",
          item_id: "item-003",
          sku: null,
          reference_id: null,
          barcode: null,
          cost: 0.5,
          default_pricing_type: "FIXED",
          default_price: 5.0,
          stores: [
            { store_id: "store-001", pricing_type: "FIXED", price: 5.0, available_for_sale: true },
          ],
          option1_name: null,
          option1_val: null,
          option2_name: null,
          option2_val: null,
          option3_name: null,
          option3_val: null,
        },
      ],
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-06-01T00:00:00.000Z",
      deleted_at: null,
    },
  ],
  categories: [
    { id: "cat-001", name: "Bagels", color: null, deleted_at: null },
    { id: "cat-002", name: "Drinks", color: null, deleted_at: null },
  ],
  modifierGroups: [
    {
      id: "mod-group-001",
      name: "Toppings",
      modifiers: [
        { id: "mod-001", name: "Extra Cream Cheese", price: 1.0 },
        { id: "mod-002", name: "Avocado", price: 2.0 },
      ],
    },
    {
      id: "mod-group-002",
      name: "Milk Choice",
      modifiers: [
        { id: "mod-003", name: "Regular Milk", price: 0 },
        { id: "mod-004", name: "Oat Milk", price: 0.8 },
      ],
    },
  ],
};

describe("normalizeLoyverseCatalog", () => {
  it("filters out deleted items", () => {
    const products = normalizeLoyverseCatalog(MOCK_CATALOG);
    const ids = products.map((p) => p.externalId);
    expect(ids).not.toContain("item-002");
    expect(ids).toContain("item-001");
    expect(ids).toContain("item-003");
  });

  it("returns the correct number of active items", () => {
    const products = normalizeLoyverseCatalog(MOCK_CATALOG);
    expect(products).toHaveLength(2);
  });

  it("maps name and price from the first variant", () => {
    const products = normalizeLoyverseCatalog(MOCK_CATALOG);
    const bagel = products.find((p) => p.externalId === "item-001")!;
    expect(bagel.name).toBe("Classic Bagel");
    expect(bagel.price).toBe(4.5);
  });

  it("resolves category name via categoryMap", () => {
    const products = normalizeLoyverseCatalog(MOCK_CATALOG);
    const bagel = products.find((p) => p.externalId === "item-001")!;
    expect(bagel.category).toBe("Bagels");
  });

  it("returns undefined category for items with no category_id", () => {
    const products = normalizeLoyverseCatalog({
      ...MOCK_CATALOG,
      items: [{ ...MOCK_CATALOG.items[0], category_id: null }],
    });
    expect(products[0].category).toBeUndefined();
  });

  it("maps modifier groups with externalId and modifiers", () => {
    const products = normalizeLoyverseCatalog(MOCK_CATALOG);
    const bagel = products.find((p) => p.externalId === "item-001")!;
    expect(bagel.modifierGroups).toHaveLength(1);
    const group = bagel.modifierGroups![0];
    expect(group.externalId).toBe("mod-group-001");
    expect(group.name).toBe("Toppings");
    expect(group.modifiers).toHaveLength(2);
    expect(group.modifiers[0]).toEqual({
      externalId: "mod-001",
      name: "Extra Cream Cheese",
      priceDelta: 1.0,
    });
  });

  it("sets modifierGroups to undefined for items with no modifiers_ids", () => {
    const products = normalizeLoyverseCatalog({
      ...MOCK_CATALOG,
      items: [{ ...MOCK_CATALOG.items[0], modifiers_ids: [] }],
    });
    expect(products[0].modifierGroups).toBeUndefined();
  });

  it("marks item as active when not deleted and has a store with available_for_sale", () => {
    const products = normalizeLoyverseCatalog(MOCK_CATALOG);
    const bagel = products.find((p) => p.externalId === "item-001")!;
    expect(bagel.isActive).toBe(true);
  });

  it("marks item as inactive when all store variants are unavailable", () => {
    const inactiveItem = {
      ...MOCK_CATALOG.items[0],
      deleted_at: null,
      variants: [
        {
          ...MOCK_CATALOG.items[0].variants[0],
          stores: [
            { store_id: "store-001", pricing_type: "FIXED" as const, price: 4.5, available_for_sale: false },
          ],
        },
      ],
    };
    const products = normalizeLoyverseCatalog({ ...MOCK_CATALOG, items: [inactiveItem] });
    expect(products[0].isActive).toBe(false);
  });

  it("resolves SKU from the first variant's sku field", () => {
    const products = normalizeLoyverseCatalog(MOCK_CATALOG);
    const bagel = products.find((p) => p.externalId === "item-001")!;
    expect(bagel.sku).toBe("SKU-001");
  });

  it("falls back to reference_id when sku is null", () => {
    const itemWithRefId = {
      ...MOCK_CATALOG.items[0],
      variants: [
        { ...MOCK_CATALOG.items[0].variants[0], sku: null, reference_id: "REF-001" },
      ],
    };
    const products = normalizeLoyverseCatalog({ ...MOCK_CATALOG, items: [itemWithRefId] });
    expect(products[0].sku).toBe("REF-001");
  });

  it("returns price 0 for items with no variants", () => {
    const noVariantItem = { ...MOCK_CATALOG.items[0], variants: [], modifiers_ids: [] };
    const products = normalizeLoyverseCatalog({ ...MOCK_CATALOG, items: [noVariantItem] });
    expect(products[0].price).toBe(0);
  });

  it("returns empty array for empty catalog", () => {
    const products = normalizeLoyverseCatalog({ items: [], categories: [], modifierGroups: [] });
    expect(products).toEqual([]);
  });
});
