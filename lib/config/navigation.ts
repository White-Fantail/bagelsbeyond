/**
 * Role-based navigation configuration.
 *
 * Each role gets its own sidebar menu:
 *  - PUBLIC   : unauthenticated users — CTA-focused, no internal menus
 *  - CUSTOMER : order/account-centric (Customer Menu)
 *  - STAFF    : day-to-day operations only — no analytics/data/admin menus
 *  - ADMIN    : full grouped sidebar with all sections
 *
 * Adding a new menu item:
 *  1. Add the item to the appropriate role config below.
 *  2. The sidebar components pick it up automatically.
 *
 * Route areas:
 *  Public    : /  /login  /signup
 *  Customer  : /account/**
 *  Staff     : /staff  /sales  /calendar
 *  Admin     : /dashboard  /analytics  /weights  /settings  /imports  /external-factors  /tasks  /admin/**
 */

import type { Role } from "@/app/generated/prisma/enums";

// ── Types ─────────────────────────────────────────────────────────────────────

export type NavItem = {
  href: string;
  label: string;
};

export type NavGroup = {
  /** Unique identifier used for open/close state tracking. */
  id: string;
  /** Display label shown as section header in the sidebar. */
  label: string;
  items: NavItem[];
};

export type RoleNavConfig = {
  /** Primary entry-point href for this role (used in the top bar). */
  dashboardHref: string;
  /** Display label for the entry-point link. */
  dashboardLabel: string;
  /** Navigation groups rendered as labelled sections in the sidebar. */
  groups: NavGroup[];
};

// ── Public (unauthenticated) ──────────────────────────────────────────────────

/**
 * Items shown to visitors who are not logged in.
 * Wrapped in a single group so the sidebar can render it uniformly.
 */
export const PUBLIC_NAV_GROUPS: NavGroup[] = [
  {
    id: "public",
    label: "Menu",
    items: [
      { href: "/", label: "Home" },
    ],
  },
];

// ── Customer (USER) ───────────────────────────────────────────────────────────

export const CUSTOMER_NAV: RoleNavConfig = {
  dashboardHref: "/account",
  dashboardLabel: "My Account",
  groups: [
    {
      id: "customer",
      label: "Customer Menu",
      items: [
        { href: "/", label: "Home" },
        { href: "/account", label: "My Account" },
      ],
    },
  ],
};

// ── Staff ─────────────────────────────────────────────────────────────────────

export const STAFF_NAV: RoleNavConfig = {
  dashboardHref: "/staff",
  dashboardLabel: "Operations Dashboard",
  groups: [
    {
      id: "dashboard",
      label: "Dashboard",
      items: [{ href: "/staff", label: "Operations Dashboard" }],
    },
    {
      id: "sales",
      label: "Sales",
      items: [
        { href: "/sales/new", label: "Enter Sales" },
        { href: "/sales", label: "Sales List" },
        { href: "/calendar", label: "Calendar" },
      ],
    },
    {
      id: "availability",
      label: "Availability",
      items: [
        { href: "/admin/bagel-availability", label: "Bagel Availability" },
      ],
    },
  ],
};

// ── Admin ─────────────────────────────────────────────────────────────────────

export const ADMIN_NAV: RoleNavConfig = {
  dashboardHref: "/dashboard",
  dashboardLabel: "Operations Dashboard",
  groups: [
    {
      id: "dashboard",
      label: "Dashboard",
      items: [{ href: "/dashboard", label: "Operations Dashboard" }],
    },
    {
      id: "sales",
      label: "Sales",
      items: [
        { href: "/calendar", label: "Calendar" },
        { href: "/sales/new", label: "Enter Sales" },
        { href: "/sales", label: "Sales List" },
      ],
    },
    {
      id: "freshness",
      label: "Freshness",
      items: [
        { href: "/freshness", label: "Freshness Dashboard" },
        { href: "/freshness/logs", label: "Log History" },
        { href: "/freshness/categories", label: "Category Settings" },
      ],
    },
    {
      id: "analytics",
      label: "Analytics / Predictions",
      items: [
        { href: "/analytics", label: "Sales Analytics" },
        { href: "/analytics/weekly", label: "Day-of-Week Analysis" },
        { href: "/predictions", label: "Sales Predictions" },
        { href: "/weights", label: "Weights Management" },
        { href: "/predictions/performance", label: "Performance Analysis" },
      ],
    },
    {
      id: "data",
      label: "Data",
      items: [
        { href: "/imports", label: "Imports" },
        { href: "/external-factors", label: "External Data" },
        { href: "/tasks", label: "Automation" },
      ],
    },
    {
      id: "costing",
      label: "Menu Costing",
      items: [
        { href: "/costing/dashboard", label: "Costing Dashboard" },
        { href: "/products", label: "Products & Recipes" },
        { href: "/product-categories", label: "Product Categories" },
        { href: "/ingredients", label: "Ingredients" },
        { href: "/ingredient-categories", label: "Ingredient Categories" },
        { href: "/suppliers", label: "Suppliers" },
        { href: "/costing/prices/bulk", label: "Bulk Price Update" },
        { href: "/costing/prices/import", label: "CSV Price Import" },
        { href: "/costing/pricing-health", label: "Pricing Health" },
        { href: "/costing/impact", label: "Cost Impact" },
      ],
    },
    {
      id: "admin",
      label: "Admin",
      items: [
        { href: "/admin/users", label: "Users" },
        { href: "/settings", label: "Settings" },
      ],
    },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the nav config for the given role, or null for unauthenticated users. */
export function getNavConfig(role?: Role | null): RoleNavConfig | null {
  if (!role) return null;
  if (role === "ADMIN") return ADMIN_NAV;
  if (role === "STAFF") return STAFF_NAV;
  return CUSTOMER_NAV;
}

/** Flattens all items from all groups into a single array. */
export function flattenNavGroups(groups: NavGroup[]): NavItem[] {
  return groups.flatMap((g) => g.items);
}

/** Returns the group id that contains the currently active route, or null. */
export function getActiveGroupId(
  groups: NavGroup[],
  pathname: string
): string | null {
  for (const group of groups) {
    for (const item of group.items) {
      if (
        pathname === item.href ||
        (item.href !== "/" && pathname.startsWith(item.href))
      ) {
        return group.id;
      }
    }
  }
  return null;
}
