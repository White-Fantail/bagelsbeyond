"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";
import type { Role } from "@/app/generated/prisma/enums";
import {
  getNavConfig,
  flattenNavGroups,
  getActiveGroupId,
  PUBLIC_NAV_GROUPS,
  type NavGroup,
} from "@/lib/config/navigation";

// ── Role display metadata ──────────────────────────────────────────────────────

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "관리자",
  STAFF: "직원",
  CUSTOMER: "고객",
};

const ROLE_BADGE_CLASS: Record<Role, string> = {
  ADMIN: "bg-red-100 text-red-700",
  STAFF: "bg-blue-100 text-blue-700",
  CUSTOMER: "bg-green-100 text-green-700",
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface NavigationProps {
  session?: { name: string; role: Role } | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Navigation({ session }: NavigationProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const navConfig = getNavConfig(session?.role);
  const groups: NavGroup[] = navConfig?.groups ?? PUBLIC_NAV_GROUPS;

  // Derive which group is active from the current pathname so we don't need
  // a setState-in-effect. User-toggled overrides are layered on top.
  const activeGroupId = getActiveGroupId(groups, pathname);
  const defaultGroupId = groups.length === 1 ? groups[0].id : null;

  // The effective open set = user-toggled groups ∪ the currently active group
  const effectiveOpenGroups: Set<string> = new Set([
    ...openGroups,
    ...(activeGroupId ? [activeGroupId] : []),
    ...(defaultGroupId && !activeGroupId ? [defaultGroupId] : []),
  ]);

  // Close menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (!isMenuOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isMenuOpen]);

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
    });
  }

  function toggleGroup(groupId: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  // Desktop: flat item list regardless of grouping
  const desktopItems = flattenNavGroups(groups);

  return (
    <nav className="bg-white border-b border-gray-200" aria-label="메인 네비게이션">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold text-amber-600">🥯</span>
              <span className="text-lg font-semibold text-gray-900 whitespace-nowrap">
                베이글스 비욘드
              </span>
            </Link>
          </div>

          {/* Desktop nav — visible on lg and above */}
          <div className="hidden lg:flex items-center gap-1 flex-1 mx-4 flex-wrap">
            {desktopItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive(item.href)
                    ? "bg-amber-100 text-amber-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Auth area — desktop */}
          <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
            {session ? (
              <>
                <Link
                  href={navConfig?.dashboardHref ?? "/account"}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700">
                    {session.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-medium">{session.name}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      ROLE_BADGE_CLASS[session.role]
                    }`}
                  >
                    {ROLE_LABELS[session.role]}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  disabled={isPending}
                  className="text-xs px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {isPending ? "…" : "로그아웃"}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="text-sm px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  className="text-sm px-3 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                >
                  회원가입
                </Link>
              </div>
            )}
          </div>

          {/* Hamburger button — visible below lg */}
          <button
            type="button"
            className="lg:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            aria-controls="mobile-menu"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((prev) => !prev)}
          >
            <span className="sr-only">{isMenuOpen ? "메뉴 닫기" : "메뉴 열기"}</span>
            {isMenuOpen ? (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      {isMenuOpen && (
        <div
          id="mobile-menu"
          className="lg:hidden border-t border-gray-200 bg-white max-h-[calc(100vh-4rem)] overflow-y-auto"
        >
          {/* Drawer header: user info or login/signup buttons */}
          {session ? (
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-sm font-bold text-amber-700 flex-shrink-0">
                  {session.name.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {session.name}
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                        ROLE_BADGE_CLASS[session.role]
                      }`}
                    >
                      {ROLE_LABELS[session.role]}
                    </span>
                  </div>
                  <Link
                    href={navConfig?.dashboardHref ?? "/account"}
                    className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {navConfig?.dashboardLabel ?? "내 계정"} →
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div className="flex gap-2">
                <Link
                  href="/login"
                  className="flex-1 text-center py-2.5 text-sm font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  className="flex-1 text-center py-2.5 text-sm font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  회원가입
                </Link>
              </div>
            </div>
          )}

          {/* Navigation items */}
          <div className="px-4 py-2">
            {groups.length === 1 ? (
              // Single group → flat list (PUBLIC, CUSTOMER, STAFF)
              <div className="space-y-0.5 py-1">
                {groups[0].items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center px-3 py-3 rounded-md text-sm font-medium transition-colors border-l-4 ${
                      isActive(item.href)
                        ? "bg-amber-100 text-amber-700 border-amber-500"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 border-transparent"
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : (
              // Multiple groups → collapsible accordion (ADMIN)
              <div className="space-y-0.5 py-1">
                {groups.map((group) => (
                  <div key={group.id}>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
                      onClick={() => toggleGroup(group.id)}
                      aria-expanded={effectiveOpenGroups.has(group.id)}
                    >
                      <span>{group.label}</span>
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${
                          effectiveOpenGroups.has(group.id) ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {effectiveOpenGroups.has(group.id) && (
                      <div className="space-y-0.5 ml-2 mb-1">
                        {group.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center px-3 py-3 rounded-md text-sm font-medium transition-colors border-l-4 ${
                              isActive(item.href)
                                ? "bg-amber-100 text-amber-700 border-amber-500"
                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 border-transparent"
                            }`}
                            onClick={() => setIsMenuOpen(false)}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Logout button — pinned at bottom of drawer */}
          {session && (
            <div className="px-4 py-3 border-t border-gray-100">
              <button
                onClick={handleLogout}
                disabled={isPending}
                className="w-full text-left px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
              >
                {isPending ? "로그아웃 중…" : "로그아웃"}
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
