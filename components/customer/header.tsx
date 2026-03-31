"use client";

import Link from "next/link";
import { useCart } from "@/lib/customer/cart-context";

interface CustomerHeaderProps {
  session: { name: string; userId: string } | null;
}

export default function CustomerHeader({ session }: CustomerHeaderProps) {
  const { itemCount } = useCart();

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/menu" className="flex items-center gap-2">
          <span className="text-2xl">🥯</span>
          <span className="font-bold text-gray-900 text-base">Bagels Beyond</span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/subscriptions" className="text-sm text-gray-600 hover:text-amber-600 font-medium hidden sm:block">
            Subscribe
          </Link>
          <Link href="/cart" className="relative p-2 text-gray-700 hover:text-amber-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-amber-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {itemCount > 9 ? "9+" : itemCount}
              </span>
            )}
          </Link>
          {session ? (
            <Link href="/account" className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-sm font-bold text-amber-700">
              {session.name.charAt(0).toUpperCase()}
            </Link>
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
