import { describe, expect, it } from "vitest";

import { hydrateItemsWithModifierGroups } from "../services/loyverseProductSyncService";

describe("hydrateItemsWithModifierGroups", () => {
  it("backfills options when item modifier groups exist but arrived without options", () => {
    const items = [
      {
        id: "item-1",
        name: "6 Bagels Deal",
        sku: null,
        description: null,
        imageUrl: null,
        categoryId: null,
        sellingPrice: null,
        isActive: true,
        modifierGroupIds: ["group-1"],
        modifierGroups: [
          {
            id: "group-1",
            name: "Choice of bagel",
            isRequired: false,
            minSelections: 0,
            maxSelections: 1,
            options: [],
          },
        ],
      },
    ];

    const hydratedGroups = [
      {
        id: "group-1",
        name: "Choice of bagel",
        isRequired: false,
        minSelections: 0,
        maxSelections: 1,
        options: [
          { id: "opt-1", name: "Plain", priceDelta: 0 },
          { id: "opt-2", name: "Sesame", priceDelta: 0.5 },
        ],
      },
    ];

    const [result] = hydrateItemsWithModifierGroups(items, hydratedGroups);

    expect(result.modifierGroups).toHaveLength(1);
    expect(result.modifierGroups[0].options).toEqual(hydratedGroups[0].options);
  });

  it("merges hydrated options into partially populated item modifier groups", () => {
    const items = [
      {
        id: "item-1",
        name: "6 Bagels Deal",
        sku: null,
        description: null,
        imageUrl: null,
        categoryId: null,
        sellingPrice: null,
        isActive: true,
        modifierGroupIds: ["group-1"],
        modifierGroups: [
          {
            id: "group-1",
            name: "Choice of bagel",
            isRequired: false,
            minSelections: 0,
            maxSelections: 1,
            options: [{ id: "opt-1", name: "Plain", priceDelta: 0 }],
          },
        ],
      },
    ];

    const hydratedGroups = [
      {
        id: "group-1",
        name: "Choice of bagel",
        isRequired: false,
        minSelections: 0,
        maxSelections: 1,
        options: [
          { id: "opt-1", name: "Plain Bagel", priceDelta: 0 },
          { id: "opt-2", name: "Sesame", priceDelta: 0.5 },
        ],
      },
    ];

    const [result] = hydrateItemsWithModifierGroups(items, hydratedGroups);

    expect(result.modifierGroups[0].options).toEqual([
      { id: "opt-1", name: "Plain Bagel", priceDelta: 0 },
      { id: "opt-2", name: "Sesame", priceDelta: 0.5 },
    ]);
  });

  it("hydrates groups by inline ids when modifierGroupIds are missing", () => {
    const items = [
      {
        id: "item-1",
        name: "6 Bagels Deal",
        sku: null,
        description: null,
        imageUrl: null,
        categoryId: null,
        sellingPrice: null,
        isActive: true,
        modifierGroupIds: [],
        modifierGroups: [
          {
            id: "group-1",
            name: "Choice of bagel",
            isRequired: false,
            minSelections: 0,
            maxSelections: 1,
            options: [],
          },
        ],
      },
    ];

    const hydratedGroups = [
      {
        id: "group-1",
        name: "Choice of bagel",
        isRequired: true,
        minSelections: 1,
        maxSelections: 1,
        options: [{ id: "opt-1", name: "Plain", priceDelta: 0 }],
      },
    ];

    const [result] = hydrateItemsWithModifierGroups(items, hydratedGroups);

    expect(result.modifierGroupIds).toEqual(["group-1"]);
    expect(result.modifierGroups[0]).toMatchObject({
      id: "group-1",
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
    });
    expect(result.modifierGroups[0].options).toEqual([{ id: "opt-1", name: "Plain", priceDelta: 0 }]);
  });
});
