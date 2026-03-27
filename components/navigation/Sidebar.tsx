import Link from "next/link";
import SidebarSection from "./SidebarSection";
import { getNavConfig, PUBLIC_NAV_GROUPS } from "@/lib/config/navigation";
import type { Role } from "@/app/generated/prisma/enums";

interface SidebarProps {
  session?: { name: string; role: Role } | null;
}

export default function Sidebar({ session }: SidebarProps) {
  const navConfig = getNavConfig(session?.role);
  const groups = navConfig?.groups ?? PUBLIC_NAV_GROUPS;

  return (
    <aside
      className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-30"
      aria-label="sidebar navigation"
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-gray-200 flex-shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-amber-600">🥯</span>
          <span className="text-lg font-semibold text-gray-900 whitespace-nowrap">
            Bagels Beyond
          </span>
        </Link>
      </div>

      {/* Navigation sections */}
      <nav className="flex-1 overflow-y-auto p-4">
        {groups.map((group) => (
          <SidebarSection key={group.id} group={group} />
        ))}
      </nav>
    </aside>
  );
}
