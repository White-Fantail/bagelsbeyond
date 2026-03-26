import { describe, it, expect, vi, beforeEach } from "vitest";
import { SubscriptionStatus, OccurrenceStatus, OrderStatus, OrderSource, FulfillmentType } from "@/app/generated/prisma/enums";

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const { mockTx, mockPrisma } = vi.hoisted(() => {
  const mockTx = {
    subscriptionOccurrence: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    order: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    dailyInventory: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };

  const mockPrisma = {
    subscription: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    subscriptionOccurrence: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    dailyInventory: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  return { mockTx, mockPrisma };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

// ─── Import after mock ────────────────────────────────────────────────────────

import {
  createSubscription,
  getSubscriptionById,
  generateOccurrencesForDate,
  generateOrdersFromOccurrences,
  cancelOccurrence,
} from "../services/subscriptionService";

// ─── Helpers ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default $transaction implementation: run callback with mockTx
  mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockTx) => Promise<unknown>) =>
    fn(mockTx)
  );
});

// ─── createSubscription ───────────────────────────────────────────────────────

describe("createSubscription", () => {
  it("calls prisma.subscription.create with correct data", async () => {
    const fakeResult = { id: "sub-1", items: [] };
    mockPrisma.subscription.create.mockResolvedValue(fakeResult);

    const result = await createSubscription({
      userId: "user-1",
      pickupWeekday: 2,
      startDate: new Date("2025-01-07T00:00:00.000Z"),
      items: [{ productId: "prod-1", quantity: 2 }],
    });

    expect(mockPrisma.subscription.create).toHaveBeenCalledOnce();
    const callArg = mockPrisma.subscription.create.mock.calls[0][0];
    expect(callArg.data.userId).toBe("user-1");
    expect(callArg.data.pickupWeekday).toBe(2);
    expect(callArg.data.items.create).toHaveLength(1);
    expect(callArg.data.items.create[0].productId).toBe("prod-1");
    expect(callArg.data.items.create[0].quantity).toBe(2);
    expect(result).toBe(fakeResult);
  });

  it("includes optional fields when provided", async () => {
    mockPrisma.subscription.create.mockResolvedValue({ id: "sub-2", items: [] });

    await createSubscription({
      userId: "user-1",
      pickupWeekday: 5,
      pickupTimeSlot: "10:00",
      startDate: new Date("2025-01-10T00:00:00.000Z"),
      endDate: new Date("2025-06-30T00:00:00.000Z"),
      note: "알레르기 주의",
      items: [{ productId: "prod-2", quantity: 1 }],
    });

    const callArg = mockPrisma.subscription.create.mock.calls[0][0];
    expect(callArg.data.pickupTimeSlot).toBe("10:00");
    expect(callArg.data.note).toBe("알레르기 주의");
  });
});

// ─── getSubscriptionById ──────────────────────────────────────────────────────

describe("getSubscriptionById", () => {
  it("returns null when subscription not found", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    const result = await getSubscriptionById("nonexistent");
    expect(result).toBeNull();
  });

  it("returns null when userId does not match", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: "sub-1",
      userId: "user-1",
      items: [],
      occurrences: [],
      user: { id: "user-1", name: "Alice", email: "alice@example.com" },
    });
    const result = await getSubscriptionById("sub-1", "user-2");
    expect(result).toBeNull();
  });

  it("returns subscription when userId matches", async () => {
    const fakeSub = {
      id: "sub-1",
      userId: "user-1",
      items: [],
      occurrences: [],
      user: { id: "user-1", name: "Alice", email: "alice@example.com" },
    };
    mockPrisma.subscription.findUnique.mockResolvedValue(fakeSub);
    const result = await getSubscriptionById("sub-1", "user-1");
    expect(result).toBe(fakeSub);
  });

  it("returns subscription without userId check when userId omitted", async () => {
    const fakeSub = {
      id: "sub-1",
      userId: "user-99",
      items: [],
      occurrences: [],
      user: { id: "user-99", name: "Bob", email: "bob@example.com" },
    };
    mockPrisma.subscription.findUnique.mockResolvedValue(fakeSub);
    const result = await getSubscriptionById("sub-1");
    expect(result).toBe(fakeSub);
  });
});

// ─── generateOccurrencesForDate ───────────────────────────────────────────────

describe("generateOccurrencesForDate", () => {
  it("only creates occurrences for subscriptions matching the weekday", async () => {
    // Tuesday = weekday 2
    const tuesday = new Date("2025-01-07T00:00:00.000Z");

    const matchingSub = { id: "sub-1", pickupWeekday: 2 };
    mockPrisma.subscription.findMany.mockResolvedValue([matchingSub]);
    mockTx.subscriptionOccurrence.findUnique.mockResolvedValue(null);
    mockTx.subscriptionOccurrence.create.mockResolvedValue({});

    const result = await generateOccurrencesForDate(tuesday);

    expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ pickupWeekday: 2 }),
      })
    );
    expect(result.created).toBe(1);
    expect(result.total).toBe(1);
  });

  it("skips duplicate occurrences", async () => {
    const tuesday = new Date("2025-01-07T00:00:00.000Z");
    mockPrisma.subscription.findMany.mockResolvedValue([{ id: "sub-1" }]);
    // Already exists
    mockTx.subscriptionOccurrence.findUnique.mockResolvedValue({ id: "existing" });

    const result = await generateOccurrencesForDate(tuesday);

    expect(mockTx.subscriptionOccurrence.create).not.toHaveBeenCalled();
    expect(result.created).toBe(0);
    expect(result.total).toBe(1);
  });
});

// ─── generateOrdersFromOccurrences ───────────────────────────────────────────

describe("generateOrdersFromOccurrences", () => {
  it("creates order with source=SUBSCRIPTION and increments reservedQty", async () => {
    const date = new Date("2025-01-07T00:00:00.000Z");

    const fakeOccurrence = {
      id: "occ-1",
      subscription: {
        id: "sub-1",
        userId: "user-1",
        pickupTimeSlot: "10:00",
        note: null,
        user: { id: "user-1", name: "Alice", email: "alice@example.com" },
        items: [
          {
            productId: "prod-1",
            product: { id: "prod-1", name: "Bagel", basePrice: 5.0 },
            quantity: 2,
          },
        ],
      },
    };

    mockPrisma.subscriptionOccurrence.findMany.mockResolvedValue([fakeOccurrence]);
    mockPrisma.order.findUnique.mockResolvedValue(null); // no duplicate order number
    mockTx.order.create.mockResolvedValue({ id: "order-1" });
    mockTx.subscriptionOccurrence.update.mockResolvedValue({});
    mockTx.dailyInventory.upsert.mockResolvedValue({});

    const result = await generateOrdersFromOccurrences(date);

    expect(mockTx.order.create).toHaveBeenCalledOnce();
    const orderData = mockTx.order.create.mock.calls[0][0].data;
    expect(orderData.source).toBe(OrderSource.SUBSCRIPTION);
    expect(orderData.status).toBe(OrderStatus.PENDING);
    expect(orderData.fulfillmentType).toBe(FulfillmentType.PICKUP);
    expect(orderData.userId).toBe("user-1");
    expect(orderData.subtotalAmount).toBe(10.0);
    expect(orderData.totalAmount).toBe(10.0);

    // Inventory should be updated
    expect(mockTx.dailyInventory.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { reservedQty: { increment: 2 } },
      })
    );

    expect(result.ordersCreated).toBe(1);
  });

  it("skips subscriptions with no items", async () => {
    const date = new Date("2025-01-07T00:00:00.000Z");

    mockPrisma.subscriptionOccurrence.findMany.mockResolvedValue([
      {
        id: "occ-2",
        subscription: {
          id: "sub-2",
          userId: "user-2",
          items: [],
          user: { id: "user-2", name: "Bob", email: "bob@example.com" },
        },
      },
    ]);

    const result = await generateOrdersFromOccurrences(date);

    expect(mockTx.order.create).not.toHaveBeenCalled();
    expect(result.ordersCreated).toBe(0);
  });
});

// ─── cancelOccurrence ─────────────────────────────────────────────────────────

describe("cancelOccurrence", () => {
  it("cancels the occurrence", async () => {
    mockPrisma.subscriptionOccurrence.findUnique.mockResolvedValue({
      id: "occ-1",
      status: OccurrenceStatus.SCHEDULED,
      orderId: null,
      order: null,
      subscription: { userId: "user-1" },
      date: new Date("2025-01-07T00:00:00.000Z"),
    });
    mockTx.subscriptionOccurrence.update.mockResolvedValue({});

    await cancelOccurrence("occ-1");

    expect(mockTx.subscriptionOccurrence.update).toHaveBeenCalledWith({
      where: { id: "occ-1" },
      data: { status: OccurrenceStatus.CANCELLED },
    });
  });

  it("rolls back reservedQty when ORDER_CREATED", async () => {
    const occDate = new Date("2025-01-07T00:00:00.000Z");

    mockPrisma.subscriptionOccurrence.findUnique.mockResolvedValue({
      id: "occ-2",
      status: OccurrenceStatus.ORDER_CREATED,
      orderId: "order-1",
      order: {
        id: "order-1",
        items: [{ productId: "prod-1", quantity: 3 }],
      },
      subscription: { userId: "user-1" },
      date: occDate,
    });
    mockTx.order.update.mockResolvedValue({});
    mockTx.dailyInventory.findUnique.mockResolvedValue({
      reservedQty: 5,
    });
    mockTx.dailyInventory.update.mockResolvedValue({});
    mockTx.subscriptionOccurrence.update.mockResolvedValue({});

    await cancelOccurrence("occ-2");

    expect(mockTx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: OrderStatus.CANCELLED },
    });

    expect(mockTx.dailyInventory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { reservedQty: 2 }, // 5 - 3
      })
    );
  });

  it("throws when occurrence not found", async () => {
    mockPrisma.subscriptionOccurrence.findUnique.mockResolvedValue(null);
    await expect(cancelOccurrence("nonexistent")).rejects.toThrow("발생 항목을 찾을 수 없습니다");
  });
});
