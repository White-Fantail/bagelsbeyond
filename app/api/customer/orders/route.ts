import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { generateOrderNumber } from "@/lib/order/order-number";

const lineModifierSchema = z.object({
  modifierOptionId: z.string(),
  optionName: z.string(),
  priceDelta: z.number(),
});

const lineSchema = z.object({
  itemId: z.string(),
  itemName: z.string(),
  unitPrice: z.number().min(0),
  quantity: z.number().int().min(1),
  modifiers: z.array(lineModifierSchema),
  note: z.string().optional(),
});

const createOrderSchema = z.object({
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickupTime: z.string(),
  note: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { pickupDate, pickupTime, note, lines } = parsed.data;

  const subtotal = lines.reduce((s, l) => {
    const modTotal = l.modifiers.reduce((ms, m) => ms + m.priceDelta, 0);
    return s + (l.unitPrice + modTotal) * l.quantity;
  }, 0);

  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      customerId: session.userId,
      status: "PENDING",
      origin: "CUSTOMER_WEB",
      pickupDate: new Date(pickupDate),
      pickupTime,
      subtotal,
      total: subtotal,
      note,
      lines: {
        create: lines.map(l => {
          const modTotal = l.modifiers.reduce((s, m) => s + m.priceDelta, 0);
          return {
            itemId: l.itemId,
            itemName: l.itemName,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            lineTotal: (l.unitPrice + modTotal) * l.quantity,
            note: l.note,
            modifiers: {
              create: l.modifiers.map(m => ({
                modifierOptionId: m.modifierOptionId,
                optionName: m.optionName,
                priceDelta: m.priceDelta,
              })),
            },
          };
        }),
      },
    },
    select: { id: true, orderNumber: true },
  });

  return NextResponse.json({ orderId: order.id, orderNumber: order.orderNumber }, { status: 201 });
}
