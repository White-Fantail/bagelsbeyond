"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";
import type { Role } from "@/app/generated/prisma/enums";

// ── Nav items per role ────────────────────────────────────────────────────────

const COMMON_ITEMS = [
  { href: "/", label: "대시보드" },
  { href: "/sales", label: "매출 목록" },
  { href: "/calendar", label: "달력" },
  { href: "/predictions", label: "예측" },
  { href: "/predictions/performance", label: "성과" },
];

const STAFF_ITEMS = [
  { href: "/imports", label: "가져오기" },
  { href: "/external-factors", label: "외부 데이터" },
  { href: "/tasks", label: "자동화" },
];

const ADMIN_ITEMS = [
  { href: "/analytics", label: "분석" },
  { href: "/weights", label: "가중치" },
  { href: "/settings", label: "설정" },
  { href: "/admin/users", label: "사용자 관리" },
];

function getNavItems(role?: Role | null) {
  if (!role) return [];
  if (role === "ADMIN") return [...COMMON_ITEMS, ...STAFF_ITEMS, ...ADMIN_ITEMS];
  if (role === "STAFF") return [...COMMON_ITEMS, ...STAFF_ITEMS];
  // CUSTOMER
  return [{ href: "/account", label: "내 계정" }];
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface NavigationProps {
  session?: { name: string; role: Role } | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Navigation({ session }: NavigationProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const navItems = getNavItems(session?.role);

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

  return (
    <nav className="bg-white border-b border-gray-200" aria-label="메인 네비게이션">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xl font-bold text-amber-600">🥯</span>
            <span className="text-lg font-semibold text-gray-900 whitespace-nowrap">
              베이글스 비욘드
            </span>
          </div>

          {/* Desktop nav — visible on lg and above */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
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
          <div className="hidden lg:flex items-center gap-3 ml-4">
            {session ? (
              <>
                <Link
                  href="/account"
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700">
                    {session.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-medium">{session.name}</span>
                  <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                    {session.role}
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
              <Link
                href="/login"
                className="text-sm px-3 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors"
              >
                로그인
              </Link>
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
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu — visible below lg when open */}
      {isMenuOpen && (
        <div id="mobile-menu" className="lg:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-2 space-y-1">
            {navItems.map((item) => (
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

            {/* Mobile auth section */}
            <div className="pt-3 pb-2 border-t border-gray-100 mt-2">
              {session ? (
                <div className="space-y-2">
                  <Link
                    href="/account"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700">
                      {session.name.charAt(0).toUpperCase()}
                    </span>
                    <span>{session.name}</span>
                    <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                      {session.role}
                    </span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    disabled={isPending}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    {isPending ? "로그아웃 중…" : "로그아웃"}
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="block px-3 py-2 text-sm font-medium text-amber-600"
                  onClick={() => setIsMenuOpen(false)}
                >
                  로그인
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
