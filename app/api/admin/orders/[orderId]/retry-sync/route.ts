import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import {
  createLoyversePickupOrder,
  getOrderSyncUpdateFromLoyverseResult,
} from "@/lib/services/loyverseService";

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

    const updateData = getOrderSyncUpdateFromLoyverseResult(loyverseResult);

    await prisma.customerOrder.update({
      where: { id: order.id },
      data: updateData,
    });

    if (loyverseResult.success) {
      return NextResponse.json({
        success: true,
        receiptId: loyverseResult.receiptId,
        status: updateData.status,
        loyverseSyncError: null,
      });
    }

    return NextResponse.json({
      success: false,
      error: loyverseResult.error,
      status: updateData.status,
      loyverseSyncError: loyverseResult.error,
    });
  } catch (error) {
    console.error("Failed to retry Loyverse sync:", error);
    return NextResponse.json(
      { message: "Failed to retry Loyverse sync" },
      { status: 500 }
    );
  }
}
