import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiRequireAuth, isNextResponse } from "@/lib/auth/dal";

const patchSchema = z.object({
  name: z
    .string()
    .min(1, "이름을 입력해주세요")
    .max(100, "이름이 너무 깁니다")
    .trim(),
});

export async function PATCH(req: NextRequest) {
  // Verify session — returns session or NextResponse error
  const authResult = await apiRequireAuth();
  if (isNextResponse(authResult)) return authResult;

  // Parse & validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "요청 본문이 올바르지 않습니다" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다" },
      { status: 400 }
    );
  }

  const { name } = parsed.data;

  try {
    // Always update by session userId — never accept id from client
    const updated = await prisma.user.update({
      where: { id: authResult.userId },
      data: { name },
      select: { id: true, name: true, email: true, role: true, updatedAt: true },
    });

    return NextResponse.json({ user: updated });
  } catch {
    return NextResponse.json(
      { message: "프로필 업데이트에 실패했습니다" },
      { status: 500 }
    );
  }
}
