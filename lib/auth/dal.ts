import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getSession, SessionPayload } from "./session";
import { Role } from "@/app/generated/prisma/enums";

// ── Role hierarchy helper ──────────────────────────────────────────────────────

const ROLE_LEVEL: Record<Role, number> = {
  [Role.CUSTOMER]: 0,
  [Role.STAFF]: 1,
  [Role.ADMIN]: 2,
};

export function hasMinimumRole(userRole: Role, required: Role): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[required];
}

export function isAdmin(role: Role): boolean {
  return role === Role.ADMIN;
}

export function isStaffOrAdmin(role: Role): boolean {
  return hasMinimumRole(role, Role.STAFF);
}

// ── verifySession (memoised per request via React cache) ──────────────────────

export const verifySession = cache(async (): Promise<SessionPayload> => {
  const session = await getSession();
  if (!session?.userId) {
    redirect("/login");
  }
  return session;
});

// ── Server-component guards (redirect on failure) ─────────────────────────────

export async function requireAuth(): Promise<SessionPayload> {
  return verifySession();
}

export async function requireRole(...roles: Role[]): Promise<SessionPayload> {
  const session = await verifySession();
  if (!roles.includes(session.role)) {
    redirect("/login?error=forbidden");
  }
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  return requireRole(Role.ADMIN);
}

export async function requireStaffOrAdmin(): Promise<SessionPayload> {
  const session = await verifySession();
  if (!isStaffOrAdmin(session.role)) {
    redirect("/login?error=forbidden");
  }
  return session;
}

// ── API route guards (return JSON error on failure) ───────────────────────────

export async function apiRequireAuth(): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ message: "인증이 필요합니다" }, { status: 401 });
  }
  return session;
}

export async function apiRequireRole(
  ...roles: Role[]
): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ message: "인증이 필요합니다" }, { status: 401 });
  }
  if (!roles.includes(session.role)) {
    return NextResponse.json({ message: "접근 권한이 없습니다" }, { status: 403 });
  }
  return session;
}

export async function apiRequireStaffOrAdmin(): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ message: "인증이 필요합니다" }, { status: 401 });
  }
  if (!isStaffOrAdmin(session.role)) {
    return NextResponse.json({ message: "접근 권한이 없습니다" }, { status: 403 });
  }
  return session;
}

export async function apiRequireAdmin(): Promise<SessionPayload | NextResponse> {
  return apiRequireRole(Role.ADMIN);
}

// ── Type narrowing helper ─────────────────────────────────────────────────────

export function isNextResponse(v: SessionPayload | NextResponse): v is NextResponse {
  return v instanceof NextResponse;
}
