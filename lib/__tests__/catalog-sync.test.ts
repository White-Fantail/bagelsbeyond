// ─── Catalog Sync Tests ───────────────────────────────────────────────────────
// Focuses on syncOptionGroups behaviour after the standalone-group model change:
// groups must be created with productId=null, and a ProductOptionGroupAssignment
// must be upserted to link the product to the group.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { IntegrationSource } from "@/app/generated/prisma/enums";
import type { ExternalModifierGroup } from "../integrations/adapters/pos/types";

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    externalProductMap: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    externalOptionGroupMap: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    productOptionGroup: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    productOptionGroupAssignment: {
      upsert: vi.fn(),
    },
    externalOptionMap: {
      upsert: vi.fn(),
    },
    productOption: {
      update: vi.fn(),
      create: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

// ─── Import after mocking ─────────────────────────────────────────────────────

import { syncExternalCatalog } from "../integrations/services/catalog-sync";
import type { POSAdapter } from "../integrations/adapters/pos/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRODUCT_ID = "prod-001";

function makeAdapter(groups: ExternalModifierGroup[] = []): POSAdapter {
  return {
    fetchExternalCatalog: vi.fn().mockResolvedValue({
      success: true,
      data: [
        {
          externalId: "ext-product-001",
          name: "Classic Bagel",
          description: "A fresh bagel",
          price: 4.5,
          isActive: true,
          category: "Bagels",
          modifierGroups: groups.length ? groups : undefined,
        },
      ],
    }),
    fetchExternalOrders: vi.fn(),
    pushOrder: vi.fn(),
  };
}

const GROUP: ExternalModifierGroup = {
  externalId: "ext-group-001",
  name: "Toppings",
  modifiers: [
    { externalId: "ext-mod-001", name: "Extra Cream Cheese", priceDelta: 1.0 },
    { externalId: "ext-mod-002", name: "Avocado", priceDelta: 2.0 },
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("syncOptionGroups — standalone-group model", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // upsertExternalProduct always goes through CREATE path (no existing map)
    mockPrisma.externalProductMap.findUnique.mockResolvedValue(null);
    mockPrisma.product.findUnique.mockResolvedValue(null); // for ensureUniqueSlug
    mockPrisma.product.create.mockResolvedValue({ id: PRODUCT_ID, slug: "classic-bagel" });
    mockPrisma.externalProductMap.create.mockResolvedValue({ id: "map-1", productId: PRODUCT_ID });

    // Default: no existing external group map, no orphan group
    mockPrisma.externalOptionGroupMap.findUnique.mockResolvedValue(null);
    mockPrisma.productOptionGroup.findFirst.mockResolvedValue(null);
    mockPrisma.productOptionGroup.create.mockResolvedValue({ id: "og-1", name: "Toppings", options: [] });
    mockPrisma.externalOptionGroupMap.create.mockResolvedValue({});
    mockPrisma.productOptionGroupAssignment.upsert.mockResolvedValue({});
    mockPrisma.productOption.create.mockResolvedValue({ id: "po-1" });
    mockPrisma.externalOptionMap.upsert.mockResolvedValue({});
  });

  it("creates a standalone group (productId: null) on first sync", async () => {
    const adapter = makeAdapter([GROUP]);
    await syncExternalCatalog(adapter, IntegrationSource.LOYVERSE);

    expect(mockPrisma.productOptionGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ productId: null, name: "Toppings" }),
      })
    );
  });

  it("upserts a ProductOptionGroupAssignment after creating the group", async () => {
    const adapter = makeAdapter([GROUP]);
    await syncExternalCatalog(adapter, IntegrationSource.LOYVERSE);

    expect(mockPrisma.productOptionGroupAssignment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          productId_optionGroupId: expect.objectContaining({ productId: PRODUCT_ID, optionGroupId: "og-1" }),
        }),
        create: expect.objectContaining({ productId: PRODUCT_ID, optionGroupId: "og-1" }),
      })
    );
  });

  it("upserts a ProductOptionGroupAssignment when re-using an existing mapped group", async () => {
    mockPrisma.externalOptionGroupMap.findUnique.mockResolvedValue({
      id: "egm-1",
      optionGroupId: "og-existing",
      optionGroup: { id: "og-existing", options: [] },
    });
    mockPrisma.productOptionGroup.update.mockResolvedValue({});
    mockPrisma.externalOptionGroupMap.update.mockResolvedValue({});

    const adapter = makeAdapter([GROUP]);
    await syncExternalCatalog(adapter, IntegrationSource.LOYVERSE);

    // Should NOT create a new group
    expect(mockPrisma.productOptionGroup.create).not.toHaveBeenCalled();

    // Should upsert assignment for the existing group
    expect(mockPrisma.productOptionGroupAssignment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ productId: PRODUCT_ID, optionGroupId: "og-existing" }),
      })
    );
  });

  it("adopts an orphan group by name (global, not per-product) and upserts assignment", async () => {
    // No external map found, but a group with the same name exists globally
    mockPrisma.externalOptionGroupMap.findUnique.mockResolvedValue(null);
    mockPrisma.productOptionGroup.findFirst.mockResolvedValue({
      id: "og-orphan",
      name: "Toppings",
      options: [],
    });
    mockPrisma.externalOptionGroupMap.create.mockResolvedValue({});

    const adapter = makeAdapter([GROUP]);
    await syncExternalCatalog(adapter, IntegrationSource.LOYVERSE);

    // Should NOT create a new group; should adopt the orphan
    expect(mockPrisma.productOptionGroup.create).not.toHaveBeenCalled();

    // Mapping should be created for the orphan group
    expect(mockPrisma.externalOptionGroupMap.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ optionGroupId: "og-orphan" }),
      })
    );

    // Assignment should be upserted
    expect(mockPrisma.productOptionGroupAssignment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ productId: PRODUCT_ID, optionGroupId: "og-orphan" }),
      })
    );
  });

  it("does not create a group or assignment when the product has no modifier groups", async () => {
    const adapter = makeAdapter([]); // no modifier groups
    await syncExternalCatalog(adapter, IntegrationSource.LOYVERSE);

    expect(mockPrisma.productOptionGroup.create).not.toHaveBeenCalled();
    expect(mockPrisma.productOptionGroupAssignment.upsert).not.toHaveBeenCalled();
  });
});
