import { NextRequest, NextResponse } from "next/server";
import { apiRequireAuth, isNextResponse } from "@/lib/auth/dal";
import { getSubscriptionById, updateSubscriptionStatus } from "@/lib/services/subscriptionService";
import { SubscriptionStatus } from "@/app/generated/prisma/enums";
import { z } from "zod";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAuth();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;
  const sub = await getSubscriptionById(id, authResult.userId);
  if (!sub) return NextResponse.json({ message: "구독을 찾을 수 없습니다" }, { status: 404 });

  return NextResponse.json({ subscription: sub });
}

const patchSchema = z.object({
  status: z.nativeEnum(SubscriptionStatus),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAuth();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "요청 본문이 올바르지 않습니다" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "입력 오류" }, { status: 400 });
  }

  try {
    const sub = await updateSubscriptionStatus(id, parsed.data.status, authResult.userId);
    return NextResponse.json({ subscription: sub });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "오류가 발생했습니다" },
      { status: 400 }
    );
  }
}
