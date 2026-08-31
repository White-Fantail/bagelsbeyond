/** Role-based navigation configuration. */

import type { Role } from "@/app/generated/prisma/enums";

export type NavItem = { href: string; label: string };
export type NavGroup = { id: string; label: string; items: NavItem[] };
export type RoleNavConfig = { dashboardHref: string; dashboardLabel: string; groups: NavGroup[] };

export const PUBLIC_NAV_GROUPS: NavGroup[] = [
  { id: "public", label: "Menu", items: [{ href: "/", label: "Home" }] },
];

export const CUSTOMER_NAV: RoleNavConfig = {
  dashboardHref: "/account",
  dashboardLabel: "My Account",
  groups: [
    { id: "customer", label: "Customer Menu", items: [{ href: "/", label: "Home" }, { href: "/account", label: "My Account" }] },
  ],
};

export const STAFF_NAV: RoleNavConfig = {
  dashboardHref: "/staff",
  dashboardLabel: "Operations Dashboard",
  groups: [
    { id: "dashboard", label: "Dashboard", items: [{ href: "/staff", label: "Operations Dashboard" }] },
    { id: "sales", label: "Sales", items: [{ href: "/sales/new", label: "Enter Sales" }, { href: "/sales", label: "Sales List" }, { href: "/calendar", label: "Calendar" }] },
    { id: "availability", label: "Availability", items: [{ href: "/admin/bagel-availability", label: "Bagel Availability" }] },
  ],
};

export const ADMIN_NAV: RoleNavConfig = {
  dashboardHref: "/dashboard",
  dashboardLabel: "Operations Dashboard",
  groups: [
    { id: "dashboard", label: "Dashboard", items: [{ href: "/dashboard", label: "Operations Dashboard" }] },
    { id: "freshness", label: "Freshness", items: [
      { href: "/freshness", label: "Freshness Dashboard" },
      { href: "/freshness/logs", label: "Log History" },
      { href: "/freshness/categories", label: "Category Settings" },
      { href: "/products", label: "Products" },
      { href: "/product-categories", label: "Product Categories" },
    ] },
    { id: "sales", label: "Sales", items: [{ href: "/calendar", label: "Calendar" }, { href: "/sales/new", label: "Enter Sales" }, { href: "/sales", label: "Sales List" }] },
    { id: "admin", label: "Admin", items: [{ href: "/admin/users", label: "Users" }] },
  ],
};

export function getNavConfig(role?: Role | null): RoleNavConfig | null {
  if (!role) return null;
  if (role === "ADMIN") return ADMIN_NAV;
  if (role === "STAFF") return STAFF_NAV;
  return CUSTOMER_NAV;
}

export function flattenNavGroups(groups: NavGroup[]): NavItem[] {
  return groups.flatMap((group) => group.items);
}

export function getActiveGroupId(groups: NavGroup[], pathname: string): string | null {
  for (const group of groups) {
    for (const item of group.items) {
      if (pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))) return group.id;
    }
  }
  return null;
}
