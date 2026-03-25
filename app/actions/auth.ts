"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/auth/session";
import { Role } from "@/app/generated/prisma/enums";

// ── Validation schema ─────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("올바른 이메일을 입력해주세요"),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});

export interface LoginState {
  errors?: { email?: string[]; password?: string[] };
  message?: string;
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function loginAction(
  _state: LoginState,
  formData: FormData
): Promise<LoginState> {
  const validated = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { email, password } = validated.data;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    return { message: "이메일 또는 비밀번호가 올바르지 않습니다" };
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    return { message: "이메일 또는 비밀번호가 올바르지 않습니다" };
  }

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
  });

  // Redirect based on role
  const destination =
    user.role === "ADMIN" ? "/admin" :
    user.role === "STAFF" ? "/staff" :
    "/account";

  redirect(destination);
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
