import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { skipOccurrence, cancelOccurrence } from "@/lib/services/subscriptionService";
import { z } from "zod";

const patchSchema = z.object({
  action: z.enum(["skip", "cancel"]),
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
    return NextResponse.json({ message: "요청 본문이 올바르지 않습니다" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "입력 오류" }, { status: 400 });
  }

  try {
    if (parsed.data.action === "skip") {
      await skipOccurrence(id);
    } else {
      await cancelOccurrence(id);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "오류가 발생했습니다" },
      { status: 400 }
    );
  }
}
