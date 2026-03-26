"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/config/navigation";

interface SidebarItemProps {
  item: NavItem;
  onClick?: () => void;
}

export default function SidebarItem({ item, onClick }: SidebarItemProps) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href ||
    (item.href !== "/" && pathname.startsWith(item.href));

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        isActive
          ? "bg-amber-100 text-amber-700"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {item.label}
    </Link>
  );
}
