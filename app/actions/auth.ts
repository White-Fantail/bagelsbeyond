"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/auth/session";
import { Role } from "@/app/generated/prisma/enums";

// ── Validation schemas ────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("올바른 이메일을 입력해주세요"),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});

const signupSchema = z
  .object({
    name: z.string().min(1, "이름을 입력해주세요").max(100, "이름이 너무 깁니다"),
    email: z.string().email("올바른 이메일을 입력해주세요"),
    password: z
      .string()
      .min(8, "비밀번호는 8자 이상이어야 합니다")
      .regex(/[A-Za-z]/, "비밀번호에 영문자가 포함되어야 합니다")
      .regex(/[0-9]/, "비밀번호에 숫자가 포함되어야 합니다"),
    passwordConfirm: z.string().min(1, "비밀번호 확인을 입력해주세요"),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["passwordConfirm"],
  });

export interface LoginState {
  errors?: { email?: string[]; password?: string[] };
  message?: string;
}

export interface SignupState {
  errors?: {
    name?: string[];
    email?: string[];
    password?: string[];
    passwordConfirm?: string[];
  };
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

// ── Signup ────────────────────────────────────────────────────────────────────

export async function signupAction(
  _state: SignupState,
  formData: FormData
): Promise<SignupState> {
  const validated = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { name, email, password } = validated.data;

  // Check for duplicate email (regardless of isActive status)
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { errors: { email: ["이미 사용 중인 이메일입니다"] } };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Role is always CUSTOMER — never trust client input
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: Role.CUSTOMER,
      isActive: true,
    },
  });

  // Auto-login after signup
  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: Role.CUSTOMER,
  });

  redirect("/account");
}
