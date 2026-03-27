import { NextRequest, NextResponse } from "next/server";
import { apiRequireStaffOrAdmin, apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { getSubscriptionById, updateSubscriptionStatus } from "@/lib/services/subscriptionService";
import { SubscriptionStatus } from "@/app/generated/prisma/enums";
import { z } from "zod";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;
  const sub = await getSubscriptionById(id);
  if (!sub) return NextResponse.json({ message: "Subscription not found" }, { status: 404 });

  return NextResponse.json({ subscription: sub });
}

const patchSchema = z.object({
  status: z.nativeEnum(SubscriptionStatus),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Input error" }, { status: 400 });
  }

  try {
    const sub = await updateSubscriptionStatus(id, parsed.data.status);
    return NextResponse.json({ subscription: sub });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "An error occurred" },
      { status: 400 }
    );
  }
}
