import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

const createSubscriptionSchema = z.object({
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]),
  pickupDays: z.array(z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"])).min(1),
  pickupTime: z.string(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
  items: z.array(z.object({
    itemId: z.string(),
    itemName: z.string(),
    unitPrice: z.number().min(0),
    quantity: z.number().int().min(1),
  })).min(1),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSubscriptionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { frequency, pickupDays, pickupTime, startDate, note, items } = parsed.data;

  const subscription = await prisma.subscription.create({
    data: {
      customerId: session.userId,
      status: "ACTIVE",
      frequency,
      pickupDays,
      pickupTime,
      startDate: new Date(startDate),
      note,
      items: {
        create: items.map(i => ({
          itemId: i.itemId,
          itemName: i.itemName,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
        })),
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ subscriptionId: subscription.id }, { status: 201 });
}
