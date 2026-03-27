"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/auth/session";
import { Role } from "@/app/generated/prisma/enums";

// ── Validation schemas ────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Please enter your password"),
});

const signupSchema = z
  .object({
    name: z.string().min(1, "Please enter your name").max(100, "Name is too long"),
    email: z.string().email("Please enter a valid email"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Za-z]/, "Password must contain a letter")
      .regex(/[0-9]/, "Password must contain a number"),
    passwordConfirm: z.string().min(1, "Please enter password confirmation"),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "Passwords do not match",
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
    return { message: "Incorrect email or password" };
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    return { message: "Incorrect email or password" };
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
    return { errors: { email: ["Email is already in use"] } };
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
