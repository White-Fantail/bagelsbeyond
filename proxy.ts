import { NextRequest, NextResponse } from "next/server";
import { decryptEdge } from "@/lib/auth/session-edge";
import { Role } from "@/app/generated/prisma/enums";

// ── Route groups ──────────────────────────────────────────────────────────────

const PUBLIC_ROUTES = ["/login"];
const ADMIN_ROUTES = ["/admin"];
const STAFF_ROUTES = ["/staff"];
const ACCOUNT_ROUTES = ["/account"];

function isAdminRoute(path: string) {
  return ADMIN_ROUTES.some((r) => path === r || path.startsWith(r + "/"));
}
function isStaffRoute(path: string) {
  return STAFF_ROUTES.some((r) => path === r || path.startsWith(r + "/"));
}
function isAccountRoute(path: string) {
  return ACCOUNT_ROUTES.some((r) => path === r || path.startsWith(r + "/"));
}
function isPublicRoute(path: string) {
  return PUBLIC_ROUTES.some((r) => path === r || path.startsWith(r + "/"));
}

const ROLE_LEVEL: Record<Role, number> = {
  [Role.CUSTOMER]: 0,
  [Role.STAFF]: 1,
  [Role.ADMIN]: 2,
};

// ── Proxy (Middleware) ────────────────────────────────────────────────────────

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Read session from cookie (optimistic check — no DB query here)
  const token = req.cookies.get("session")?.value;
  const session = await decryptEdge(token);

  const isAuthenticated = !!session?.userId;
  const role = session?.role as Role | undefined;

  // Redirect authenticated users away from login page
  if (isPublicRoute(path) && isAuthenticated) {
    const dest =
      role === Role.ADMIN ? "/admin" :
      role === Role.STAFF ? "/staff" :
      "/account";
    return NextResponse.redirect(new URL(dest, req.nextUrl));
  }

  // Protected routes — must be authenticated
  const isProtected =
    isAdminRoute(path) || isStaffRoute(path) || isAccountRoute(path);

  if (isProtected && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // Admin-only routes
  if (isAdminRoute(path) && role && ROLE_LEVEL[role] < ROLE_LEVEL[Role.ADMIN]) {
    return NextResponse.redirect(new URL("/login?error=forbidden", req.nextUrl));
  }

  // Staff-or-admin routes
  if (isStaffRoute(path) && role && ROLE_LEVEL[role] < ROLE_LEVEL[Role.STAFF]) {
    return NextResponse.redirect(new URL("/login?error=forbidden", req.nextUrl));
  }

  return NextResponse.next();
}

// Run on all routes except static files / API routes
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)"],
};
