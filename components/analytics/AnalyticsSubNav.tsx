"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

type Props = {
  items: NavItem[];
};

export default function AnalyticsSubNav({ items }: Props) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || (href !== "/analytics" && pathname.startsWith(href));

  return (
    <nav className="flex gap-1 flex-wrap" aria-label="분석 서브 네비게이션">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
            isActive(item.href)
              ? "bg-amber-100 text-amber-700"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
