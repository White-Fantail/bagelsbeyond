"use client";

import Link from "next/link";
import { useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";

interface CustomerHeaderProps {
  session: { name: string; userId: string } | null;
}

export default function CustomerHeader({ session }: CustomerHeaderProps) {
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
    });
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🥯</span>
          <span className="font-bold text-gray-900 text-base">Bagels Beyond</span>
        </Link>
        <nav className="flex items-center gap-3">
          {session ? (
            <>
              <Link href="/account" className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-sm font-bold text-amber-700">
                {session.name.charAt(0).toUpperCase()}
              </Link>
              <button
                onClick={handleLogout}
                disabled={isPending}
                className="text-xs px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {isPending ? "…" : "Sign out"}
              </button>
            </>
          ) : (
            <Link href="/login" className="text-sm px-3 py-1.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700">
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
