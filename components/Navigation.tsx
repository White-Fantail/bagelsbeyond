"use client";

import Link from "next/link";
import { useState, useEffect, useTransition } from "react";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import MobileDrawer from "./navigation/MobileDrawer";
import { getNavConfig } from "@/lib/config/navigation";
import type { Role } from "@/app/generated/prisma/enums";

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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const navConfig = getNavConfig(session?.role);

  // Close drawer on route change
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (!isDrawerOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isDrawerOpen]);

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
    });
  }

  return (
    <>
      {/* ── Top bar ── */}
      <header
        className="fixed top-0 right-0 left-0 lg:left-64 h-16 bg-white border-b border-gray-200 z-20 flex items-center px-4 sm:px-6"
        aria-label="상단 바"
      >
        {/* Mobile: hamburger + store name */}
        <div className="flex items-center gap-3 lg:hidden">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="p-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            aria-label="메뉴 열기"
            aria-expanded={isDrawerOpen}
          >
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
          </button>
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold text-amber-600">🥯</span>
            <span className="text-base font-semibold text-gray-900">
              베이글스 비욘드
            </span>
          </Link>
        </div>

        {/* Spacer — desktop store name is shown in the sidebar */}
        <div className="hidden lg:flex flex-1" />

        {/* Auth area */}
        <div className="flex items-center gap-3 ml-auto">
          {session ? (
            <>
              <Link
                href={navConfig?.dashboardHref ?? "/account"}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700 flex-shrink-0">
                  {session.name.charAt(0).toUpperCase()}
                </span>
                <span className="font-medium hidden sm:block">
                  {session.name}
                </span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-medium hidden sm:block ${
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
      </header>

      {/* ── Mobile drawer ── */}
      <MobileDrawer
        session={session}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </>
  );
}
