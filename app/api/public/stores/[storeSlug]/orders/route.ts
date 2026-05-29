import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createOrderSchema } from "@/lib/validations";
import { createLoyversePickupOrder } from "@/lib/services/loyverseService";
import { Decimal } from "decimal.js";

/**
 * Public Order Submission API
 * POST /api/public/stores/[storeSlug]/orders
 * Creates a new customer order with items and modifiers.
 * No authentication required.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeSlug: string }> }
) {
  try {
    const { storeSlug } = await params;
    const body = await request.json();

    // Validate input
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid input", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Find store
    const store = await prisma.store.findUnique({
      where: { slug: storeSlug },
    });

    if (!store) {
      return NextResponse.json(
        { message: "Store not found" },
        { status: 404 }
      );
    }

    if (!store.isOpen) {
      return NextResponse.json(
        { message: "Store is currently closed" },
        { status: 400 }
      );
    }

    // Validate all items exist and are active
    const itemIds = data.items.map((item) => item.itemId);
    const products = await prisma.menuProduct.findMany({
      where: {
        id: { in: itemIds },
        isActive: true,
      },
      include: {
        modifierGroups: {
          where: { isActive: true },
          include: {
            options: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    if (products.length !== itemIds.length) {
      return NextResponse.json(
        { message: "One or more items are not available" },
        { status: 400 }
      );
    }

    // Build product map for validation and price calculation
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Calculate prices and validate modifiers
    let subtotal = new Decimal(0);
    const orderItems: Array<{
      itemId: string;
      itemNameSnapshot: string;
      quantity: number;
      unitPrice: Decimal;
      totalPrice: Decimal;
      notes: string | null;
      modifiers: Array<{
        modifierGroupId: string;
        modifierGroupName: string;
        modifierOptionId: string;
        modifierOptionName: string;
        priceDelta: Decimal;
      }>;
    }> = [];

    for (const item of data.items) {
      const product = productMap.get(item.itemId);
      if (!product || product.isSoldOut) {
        return NextResponse.json(
          { message: `Product ${product?.name || "unknown"} is sold out` },
          { status: 400 }
        );
      }

      if (!product.sellingPrice) {
        return NextResponse.json(
          { message: `Product ${product.name} does not have a price set` },
          { status: 400 }
        );
      }

      let unitPrice = new Decimal(product.sellingPrice.toString());
      const modifiers = [];

      // Validate and calculate modifiers
      for (const selectedMod of item.selectedModifiers) {
        const modifierGroup = product.modifierGroups.find(
          (g) => g.id === selectedMod.modifierGroupId
        );

        if (!modifierGroup) {
          return NextResponse.json(
            { message: `Invalid modifier group for ${product.name}` },
            { status: 400 }
          );
        }

        const modifierOption = modifierGroup.options.find(
          (o) => o.id === selectedMod.modifierOptionId
        );

        if (!modifierOption) {
          return NextResponse.json(
            { message: `Invalid modifier option for ${product.name}` },
            { status: 400 }
          );
        }

        const priceDelta = new Decimal(modifierOption.priceDelta.toString());
        unitPrice = unitPrice.plus(priceDelta);

        modifiers.push({
          modifierGroupId: modifierGroup.id,
          modifierGroupName: modifierGroup.name,
          modifierOptionId: modifierOption.id,
          modifierOptionName: modifierOption.name,
          priceDelta: modifierOption.priceDelta,
        });
      }

      // Validate required modifiers are selected
      for (const group of product.modifierGroups) {
        if (group.isRequired) {
          const selectedCount = item.selectedModifiers.filter(
            (m) => m.modifierGroupId === group.id
          ).length;
          if (selectedCount < group.minSelections) {
            return NextResponse.json(
              {
                message: `${product.name}: ${group.name} requires at least ${group.minSelections} selection(s)`,
              },
              { status: 400 }
            );
          }
        }
      }

      const itemTotal = unitPrice.times(item.quantity);
      subtotal = subtotal.plus(itemTotal);

      orderItems.push({
        itemId: product.id,
        itemNameSnapshot: product.name,
        quantity: item.quantity,
        unitPrice: unitPrice.toDecimalPlaces(2),
        totalPrice: itemTotal.toDecimalPlaces(2),
        notes: item.notes || null,
        modifiers,
      });
    }

    const total = subtotal; // No tax/fees for now

    // Generate order number: BB-timestamp-random4chars
    // Take 4 hex chars from a UUID to build a short, well-distributed order number suffix
    const timestamp = Date.now();
    const randomSuffix = crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
    const orderNumber = `BB-${timestamp}-${randomSuffix}`;

    // Create order in transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.customerOrder.create({
        data: {
          orderNumber,
          storeId: store.id,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail || null,
          pickupType: data.pickupType,
          pickupTime: data.pickupTime ? new Date(data.pickupTime) : null,
          status: "PENDING",
          subtotal: subtotal.toDecimalPlaces(2),
          total: total.toDecimalPlaces(2),
          notes: data.notes || null,
          items: {
            create: orderItems.map((orderItem) => ({
              itemId: orderItem.itemId,
              itemNameSnapshot: orderItem.itemNameSnapshot,
              quantity: orderItem.quantity,
              unitPrice: orderItem.unitPrice,
              totalPrice: orderItem.totalPrice,
              notes: orderItem.notes,
              modifiers: {
                create: orderItem.modifiers,
              },
            })),
          },
        },
        include: {
          items: {
            include: {
              modifiers: true,
            },
          },
        },
      });

      return newOrder;
    });

    // Attempt Loyverse sync (non-blocking)
    try {
      const loyverseResult = await createLoyversePickupOrder({
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        pickupType: order.pickupType,
        pickupTime: order.pickupTime,
        notes: order.notes,
        items: order.items.map((item) => ({
          itemId: item.itemId,
          itemNameSnapshot: item.itemNameSnapshot,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          modifiers: item.modifiers.map((mod) => ({
            modifierGroupName: mod.modifierGroupName,
            modifierOptionName: mod.modifierOptionName,
            priceDelta: Number(mod.priceDelta),
          })),
        })),
        subtotal: Number(order.subtotal),
        total: Number(order.total),
      });

      if (loyverseResult.success && loyverseResult.receiptId) {
        await prisma.customerOrder.update({
          where: { id: order.id },
          data: {
            status: "SENT_TO_LOYVERSE",
            loyverseReceiptId: loyverseResult.receiptId,
          },
        });
      } else if (loyverseResult.error) {
        await prisma.customerOrder.update({
          where: { id: order.id },
          data: {
            status: "FAILED_TO_SEND",
            loyverseSyncError: loyverseResult.error,
          },
        });
      }
    } catch (loyverseError) {
      console.error("Loyverse sync error:", loyverseError);
      // Don't fail the order if Loyverse sync fails
      await prisma.customerOrder.update({
        where: { id: order.id },
        data: {
          status: "FAILED_TO_SEND",
          loyverseSyncError:
            loyverseError instanceof Error
              ? loyverseError.message
              : "Unknown error",
        },
      });
    }

    return NextResponse.json(
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        estimatedPickupMinutes: 20,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create order:", error);
    return NextResponse.json(
      { message: "Failed to create order" },
      { status: 500 }
    );
  }
}
