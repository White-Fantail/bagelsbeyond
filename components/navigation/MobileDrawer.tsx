"use client";

import Link from "next/link";
import { useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";
import SidebarSection from "./SidebarSection";
import { getNavConfig, PUBLIC_NAV_GROUPS } from "@/lib/config/navigation";
import type { Role } from "@/app/generated/prisma/enums";

interface MobileDrawerProps {
  session?: { name: string; role: Role } | null;
  isOpen: boolean;
  onClose: () => void;
}

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

export default function MobileDrawer({
  session,
  isOpen,
  onClose,
}: MobileDrawerProps) {
  const [isPending, startTransition] = useTransition();
  const navConfig = getNavConfig(session?.role);
  const groups = navConfig?.groups ?? PUBLIC_NAV_GROUPS;

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
    });
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div className="fixed inset-y-0 left-0 w-72 bg-white z-50 lg:hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 flex-shrink-0">
          <Link href="/" className="flex items-center gap-2" onClick={onClose}>
            <span className="text-xl font-bold text-amber-600">🥯</span>
            <span className="text-lg font-semibold text-gray-900">
              베이글스 비욘드
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="메뉴 닫기"
          >
            <svg
              className="w-5 h-5"
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
          </button>
        </div>

        {/* User info */}
        {session && (
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-sm font-bold text-amber-700 flex-shrink-0">
                {session.name.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {session.name}
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${
                      ROLE_BADGE_CLASS[session.role]
                    }`}
                  >
                    {ROLE_LABELS[session.role]}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Nav sections */}
        <nav
          className="flex-1 p-4 overflow-y-auto"
          aria-label="모바일 네비게이션"
        >
          {groups.map((group) => (
            <SidebarSection
              key={group.id}
              group={group}
              onItemClick={onClose}
            />
          ))}
        </nav>

        {/* Auth links for unauthenticated users */}
        {!session && (
          <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
            <div className="flex gap-2">
              <Link
                href="/login"
                onClick={onClose}
                className="flex-1 text-center py-2.5 text-sm font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                onClick={onClose}
                className="flex-1 text-center py-2.5 text-sm font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors"
              >
                회원가입
              </Link>
            </div>
          </div>
        )}

        {/* Logout for authenticated users */}
        {session && (
          <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
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
    </>
  );
}
