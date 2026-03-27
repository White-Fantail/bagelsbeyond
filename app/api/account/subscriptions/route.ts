import { NextRequest, NextResponse } from "next/server";
import { apiRequireAuth, isNextResponse } from "@/lib/auth/dal";
import { getUserSubscriptions, createSubscription } from "@/lib/services/subscriptionService";
import { z } from "zod";

export async function GET() {
  const authResult = await apiRequireAuth();
  if (isNextResponse(authResult)) return authResult;

  try {
    const subscriptions = await getUserSubscriptions(authResult.userId);
    return NextResponse.json({ subscriptions });
  } catch {
    return NextResponse.json({ message: "Failed to load subscription list" }, { status: 500 });
  }
}

const createSchema = z.object({
  pickupWeekday: z.number().int().min(0).max(6),
  pickupTimeSlot: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().max(500).optional(),
  items: z.array(z.object({ productId: z.string(), quantity: z.number().int().min(1) })).min(1),
});

export async function POST(req: NextRequest) {
  const authResult = await apiRequireAuth();
  if (isNextResponse(authResult)) return authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Input error" }, { status: 400 });
  }

  const { startDate, endDate, ...rest } = parsed.data;

  try {
    const sub = await createSubscription({
      ...rest,
      userId: authResult.userId,
      startDate: new Date(startDate + "T00:00:00.000Z"),
      endDate: endDate ? new Date(endDate + "T00:00:00.000Z") : undefined,
    });
    return NextResponse.json({ subscription: sub }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Error creating subscription" }, { status: 500 });
  }
}
