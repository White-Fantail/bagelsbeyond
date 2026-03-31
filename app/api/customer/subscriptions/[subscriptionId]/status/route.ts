import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

const statusSchema = z.object({
  action: z.enum(["pause", "resume", "cancel"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subscriptionId } = await params;
  const body = await req.json();
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 422 });

  const sub = await prisma.subscription.findFirst({
    where: { id: subscriptionId, customerId: session.userId },
  });
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  let update: Record<string, unknown> = {};
  if (parsed.data.action === "pause") {
    update = { status: "PAUSED", pausedAt: now };
  } else if (parsed.data.action === "resume") {
    update = { status: "ACTIVE", pausedAt: null };
  } else {
    update = { status: "CANCELLED", cancelledAt: now };
  }

  await prisma.subscription.update({ where: { id: subscriptionId }, data: update });
  return NextResponse.json({ success: true });
}
