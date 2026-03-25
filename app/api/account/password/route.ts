import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { apiRequireAuth, isNextResponse } from "@/lib/auth/dal";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "현재 비밀번호를 입력해주세요"),
    newPassword: z
      .string()
      .min(8, "비밀번호는 8자 이상이어야 합니다")
      .regex(/[A-Za-z]/, "비밀번호에 영문자가 포함되어야 합니다")
      .regex(/[0-9]/, "비밀번호에 숫자가 포함되어야 합니다"),
    confirmPassword: z.string().min(1, "비밀번호 확인을 입력해주세요"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "새 비밀번호가 일치하지 않습니다",
    path: ["confirmPassword"],
  });

export async function POST(req: NextRequest) {
  // Verify session
  const authResult = await apiRequireAuth();
  if (isNextResponse(authResult)) return authResult;

  // Parse & validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "요청 본문이 올바르지 않습니다" }, { status: 400 });
  }

  const parsed = passwordSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return NextResponse.json(
      { message: firstError?.message ?? "입력값이 올바르지 않습니다" },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  // Fetch current password hash — always by session userId
  const user = await prisma.user.findUnique({
    where: { id: authResult.userId },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다" }, { status: 404 });
  }

  // Verify current password
  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    return NextResponse.json(
      { message: "현재 비밀번호가 올바르지 않습니다" },
      { status: 422 }
    );
  }

  // Reject if new password is the same as current
  const isSame = await bcrypt.compare(newPassword, user.passwordHash);
  if (isSame) {
    return NextResponse.json(
      { message: "새 비밀번호는 현재 비밀번호와 달라야 합니다" },
      { status: 422 }
    );
  }

  const newHash = await bcrypt.hash(newPassword, 12);

  try {
    await prisma.user.update({
      where: { id: authResult.userId },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({ message: "비밀번호가 변경되었습니다" });
  } catch {
    return NextResponse.json(
      { message: "비밀번호 변경에 실패했습니다" },
      { status: 500 }
    );
  }
}
