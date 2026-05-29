import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { createLoyversePickupOrder } from "@/lib/services/loyverseService";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const { orderId } = await params;

    const order = await prisma.customerOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { message: "Order not found" },
        { status: 404 }
      );
    }

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
          loyverseSyncError: null,
        },
      });
      return NextResponse.json({ success: true, receiptId: loyverseResult.receiptId });
    } else {
      await prisma.customerOrder.update({
        where: { id: order.id },
        data: {
          status: "FAILED_TO_SEND",
          loyverseSyncError: loyverseResult.error,
        },
      });
      return NextResponse.json({ success: false, error: loyverseResult.error });
    }
  } catch (error) {
    console.error("Failed to retry Loyverse sync:", error);
    return NextResponse.json(
      { message: "Failed to retry Loyverse sync" },
      { status: 500 }
    );
  }
}
