import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { apiRequireAuth, isNextResponse } from "@/lib/auth/dal";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Please enter your current password"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Za-z]/, "Password must contain a letter")
      .regex(/[0-9]/, "Password must contain a number"),
    confirmPassword: z.string().min(1, "Please enter password confirmation"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "New passwords do not match",
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
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = passwordSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return NextResponse.json(
      { message: firstError?.message ?? "Invalid input" },
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
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  // Verify current password
  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    return NextResponse.json(
      { message: "Current password is incorrect" },
      { status: 422 }
    );
  }

  // Reject if new password is the same as current
  const isSame = await bcrypt.compare(newPassword, user.passwordHash);
  if (isSame) {
    return NextResponse.json(
      { message: "New password must be different from current password" },
      { status: 422 }
    );
  }

  const newHash = await bcrypt.hash(newPassword, 12);

  try {
    await prisma.user.update({
      where: { id: authResult.userId },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({ message: "Password changed" });
  } catch {
    return NextResponse.json(
      { message: "Failed to change password" },
      { status: 500 }
    );
  }
}
