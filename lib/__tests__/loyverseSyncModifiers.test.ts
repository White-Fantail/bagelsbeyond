/**
 * Tests for syncLoyverseCatalog modifier-group / option saving behaviour.
 *
 * Key scenario verified here (mirrors old catalog-sync.ts behaviour):
 *   When a product already has local modifier groups or options that were created
 *   manually (loyverseId === null), the sync must locate them by *name* and stamp
 *   their loyverseId rather than creating duplicate records.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// ── Prisma mock ────────────────────────────────────────────────────────────────
// vi.mock is hoisted, so the mock object must be created via vi.hoisted.
const prisma = vi.hoisted(() => ({
  loyverseSyncLog: {
    create: vi.fn(),
    update: vi.fn(),
  },
  productCategory: {
    aggregate: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  menuProduct: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  menuModifierGroup: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  menuModifierOption: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma }));

// ── Import after mocks ─────────────────────────────────────────────────────────
import { syncLoyverseCatalog } from "../services/loyverseProductSyncService";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeFetchResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

/** Build the minimal Loyverse API responses needed for a single-item catalog sync. */
function setupFetchForOneItem() {
  const fetchMock = vi.fn();

  // categories endpoint → empty
  // items endpoint → one item with modifier_list_ids referencing group-a
  // modifier_lists endpoint → group-a with option Plain and option Sesame
  // modifiers endpoint (fallback, not needed here) → skip
  fetchMock.mockImplementation((url: string) => {
    const u = url.toString();
    if (u.includes("/categories")) {
      return Promise.resolve(makeFetchResponse({ categories: [] }));
    }
    if (u.includes("/items")) {
      return Promise.resolve(
        makeFetchResponse({
          items: [
            {
              id: "lv-item-1",
              item_name: "Bagel Dozen",
              sku: null,
              category_id: null,
              deleted_at: null,
              modifier_list_ids: ["lv-group-a"],
            },
          ],
        })
      );
    }
    if (u.includes("/modifier_lists")) {
      return Promise.resolve(
        makeFetchResponse({
          modifier_lists: [
            {
              id: "lv-group-a",
              name: "Choice of Bagel",
              min_selections: 1,
              max_selections: 1,
              required: true,
              options: [
                { id: "lv-opt-plain", name: "Plain", price: 0 },
                { id: "lv-opt-sesame", name: "Sesame", price: 0.5 },
              ],
            },
          ],
        })
      );
    }
    // fallback — should not be called in the happy path
    return Promise.resolve(makeFetchResponse({}));
  });

  vi.stubGlobal("fetch", fetchMock);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("syncLoyverseCatalog — modifier group/option saving", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LOYVERSE_API_TOKEN = "test-token";

    // SyncLog create/update
    prisma.loyverseSyncLog.create.mockResolvedValue({ id: "log-1" });
    prisma.loyverseSyncLog.update.mockResolvedValue({ id: "log-1" });

    // No categories in local DB
    prisma.productCategory.findMany.mockResolvedValue([]);
    prisma.productCategory.aggregate.mockResolvedValue({ _max: { sortOrder: -1 } });

    // Product already linked by loyverseId
    prisma.menuProduct.findUnique.mockResolvedValue({ id: "local-product-1" });
    prisma.menuProduct.update.mockResolvedValue({ id: "local-product-1" });
  });

  it("creates modifier group and options when none exist locally", async () => {
    setupFetchForOneItem();

    // No existing groups or options
    prisma.menuModifierGroup.findMany.mockResolvedValue([]);
    prisma.menuModifierGroup.findFirst.mockResolvedValue(null);
    prisma.menuModifierGroup.create.mockResolvedValue({ id: "local-group-1" });

    prisma.menuModifierOption.findMany.mockResolvedValue([]);
    prisma.menuModifierOption.findFirst.mockResolvedValue(null);
    prisma.menuModifierOption.create.mockResolvedValue({ id: "local-opt-1" });

    await syncLoyverseCatalog("user-1", {});

    // Group created with loyverseId
    expect(prisma.menuModifierGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          loyverseId: "lv-group-a",
          name: "Choice of Bagel",
          productId: "local-product-1",
        }),
      })
    );

    // Both options created
    expect(prisma.menuModifierOption.create).toHaveBeenCalledTimes(2);
    expect(prisma.menuModifierOption.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ loyverseId: "lv-opt-plain", name: "Plain" }),
      })
    );
    expect(prisma.menuModifierOption.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ loyverseId: "lv-opt-sesame", name: "Sesame" }),
      })
    );
  });

  it("updates modifier group and options when already linked by loyverseId", async () => {
    setupFetchForOneItem();

    // Group already linked
    prisma.menuModifierGroup.findMany.mockResolvedValue([]);
    prisma.menuModifierGroup.findFirst.mockResolvedValue({ id: "local-group-1" });
    prisma.menuModifierGroup.update.mockResolvedValue({ id: "local-group-1" });

    // Options already linked
    prisma.menuModifierOption.findMany.mockResolvedValue([]);
    prisma.menuModifierOption.findFirst.mockResolvedValue({ id: "local-opt-existing" });
    prisma.menuModifierOption.update.mockResolvedValue({ id: "local-opt-existing" });

    await syncLoyverseCatalog("user-1", {});

    expect(prisma.menuModifierGroup.create).not.toHaveBeenCalled();
    expect(prisma.menuModifierGroup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ loyverseId: "lv-group-a", name: "Choice of Bagel" }),
      })
    );
    expect(prisma.menuModifierOption.create).not.toHaveBeenCalled();
  });

  it("falls back to name-based lookup for orphan group (no loyverseId) and stamps loyverseId", async () => {
    setupFetchForOneItem();

    prisma.menuModifierGroup.findMany.mockResolvedValue([]);

    // First findFirst call: loyverseId lookup → null (not yet linked)
    // Second findFirst call: name-based fallback → finds orphan record
    prisma.menuModifierGroup.findFirst
      .mockResolvedValueOnce(null) // loyverseId lookup
      .mockResolvedValueOnce({ id: "orphan-group-1" }); // name-based fallback
    prisma.menuModifierGroup.update.mockResolvedValue({ id: "orphan-group-1" });

    // Options: both new
    prisma.menuModifierOption.findMany.mockResolvedValue([]);
    prisma.menuModifierOption.findFirst.mockResolvedValue(null);
    prisma.menuModifierOption.create.mockResolvedValue({ id: "new-opt" });

    await syncLoyverseCatalog("user-1", {});

    // Must NOT create a new group — must update the orphan
    expect(prisma.menuModifierGroup.create).not.toHaveBeenCalled();

    // Must stamp loyverseId on the orphan group
    expect(prisma.menuModifierGroup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "orphan-group-1" },
        data: expect.objectContaining({ loyverseId: "lv-group-a" }),
      })
    );
  });

  it("falls back to name-based lookup for orphan option (no loyverseId) and stamps loyverseId", async () => {
    setupFetchForOneItem();

    prisma.menuModifierGroup.findMany.mockResolvedValue([]);
    // Group found by loyverseId immediately
    prisma.menuModifierGroup.findFirst.mockResolvedValue({ id: "local-group-1" });
    prisma.menuModifierGroup.update.mockResolvedValue({ id: "local-group-1" });

    prisma.menuModifierOption.findMany.mockResolvedValue([]);

    // Option "Plain": loyverseId lookup → null; name fallback → finds orphan
    // Option "Sesame": loyverseId lookup → null; name fallback → null → create
    let optionCallCount = 0;
    prisma.menuModifierOption.findFirst.mockImplementation(() => {
      optionCallCount += 1;
      // calls 1,2 = Plain (loyverse→null, name→orphan); calls 3,4 = Sesame (loyverse→null, name→null)
      if (optionCallCount === 1) return Promise.resolve(null); // Plain loyverseId miss
      if (optionCallCount === 2) return Promise.resolve({ id: "orphan-opt-plain" }); // Plain name hit
      return Promise.resolve(null); // Sesame both miss → create
    });
    prisma.menuModifierOption.update.mockResolvedValue({ id: "orphan-opt-plain" });
    prisma.menuModifierOption.create.mockResolvedValue({ id: "new-opt-sesame" });

    await syncLoyverseCatalog("user-1", {});

    // Plain option must be updated (not created) with loyverseId stamped
    expect(prisma.menuModifierOption.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "orphan-opt-plain" },
        data: expect.objectContaining({ loyverseId: "lv-opt-plain", name: "Plain" }),
      })
    );

    // Sesame option has no local record → must be created
    expect(prisma.menuModifierOption.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ loyverseId: "lv-opt-sesame", name: "Sesame" }),
      })
    );
  });
});
