/**
 * Role-based navigation configuration.
 *
 * Each role gets its own menu policy:
 *  - PUBLIC   : unauthenticated users — CTA-focused, no internal menus
 *  - CUSTOMER : order/account-centric, no operational menus
 *  - STAFF    : day-to-day operations only, no admin-only menus
 *  - ADMIN    : full grouped menu with overview/operations/data/management
 *
 * Adding a new menu item:
 *  1. Add the item to the appropriate role config below.
 *  2. The navigation component picks it up automatically.
 *
 * Route areas:
 *  Public    : /  /order  /subscribe  /login  /signup
 *  Customer  : /account/**
 *  Staff     : /staff  /admin/orders  /sales  /calendar  /admin/inventory  /predictions
 *  Admin     : /admin/**  /analytics  /weights  /settings  /imports  /external-factors  /tasks
 */

import type { Role } from "@/app/generated/prisma/enums";

// ── Types ─────────────────────────────────────────────────────────────────────

export type NavItem = {
  href: string;
  label: string;
};

export type NavGroup = {
  /** Unique identifier used for accordion open/close state. */
  id: string;
  /** Display label shown as section header in mobile accordion. */
  label: string;
  items: NavItem[];
};

export type RoleNavConfig = {
  /** Primary entry-point href for this role (shown in mobile drawer header). */
  dashboardHref: string;
  /** Display label for the entry-point link. */
  dashboardLabel: string;
  /**
   * Navigation groups.
   * - Single group  → rendered as a flat list (CUSTOMER, STAFF).
   * - Multiple groups → rendered as collapsible accordion sections (ADMIN).
   */
  groups: NavGroup[];
};

// ── Public (unauthenticated) ──────────────────────────────────────────────────

/**
 * Items shown to visitors who are not logged in.
 * Wrapped in a single group so the component can treat it uniformly.
 */
export const PUBLIC_NAV_GROUPS: NavGroup[] = [
  {
    id: "public",
    label: "메뉴",
    items: [
      { href: "/", label: "홈" },
      { href: "/order", label: "주문하기" },
      { href: "/subscribe", label: "구독" },
    ],
  },
];

// ── Customer ──────────────────────────────────────────────────────────────────

export const CUSTOMER_NAV: RoleNavConfig = {
  dashboardHref: "/account",
  dashboardLabel: "내 계정",
  groups: [
    {
      id: "customer",
      label: "메뉴",
      items: [
        { href: "/", label: "홈" },
        { href: "/order", label: "주문하기" },
        { href: "/account/orders", label: "내 주문" },
        { href: "/subscribe", label: "내 구독" },
        { href: "/account", label: "내 계정" },
      ],
    },
  ],
};

// ── Staff ─────────────────────────────────────────────────────────────────────

export const STAFF_NAV: RoleNavConfig = {
  dashboardHref: "/staff",
  dashboardLabel: "운영 대시보드",
  groups: [
    {
      id: "staff",
      label: "운영",
      items: [
        { href: "/staff", label: "운영 대시보드" },
        { href: "/admin/orders", label: "주문 관리" },
        { href: "/sales", label: "매출 목록" },
        { href: "/calendar", label: "달력" },
        { href: "/admin/inventory", label: "재고 관리" },
        { href: "/predictions", label: "예측" },
      ],
    },
  ],
};

// ── Admin ─────────────────────────────────────────────────────────────────────

export const ADMIN_NAV: RoleNavConfig = {
  dashboardHref: "/admin",
  dashboardLabel: "관리자 대시보드",
  groups: [
    {
      id: "overview",
      label: "개요",
      items: [
        { href: "/admin", label: "관리자 대시보드" },
        { href: "/calendar", label: "달력" },
        { href: "/analytics", label: "분석" },
        { href: "/predictions", label: "예측" },
      ],
    },
    {
      id: "operations",
      label: "운영",
      items: [
        { href: "/admin/orders", label: "주문 관리" },
        { href: "/sales", label: "매출 목록" },
        { href: "/admin/inventory", label: "재고 관리" },
        { href: "/admin/products", label: "상품 관리" },
        { href: "/imports", label: "가져오기" },
      ],
    },
    {
      id: "data",
      label: "데이터",
      items: [
        { href: "/external-factors", label: "외부 데이터" },
        { href: "/tasks", label: "자동화" },
        { href: "/weights", label: "가중치" },
        { href: "/predictions/performance", label: "성과" },
      ],
    },
    {
      id: "management",
      label: "관리",
      items: [
        { href: "/admin/users", label: "사용자 관리" },
        { href: "/settings", label: "설정" },
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

/** Flattens all items from all groups into a single array (used for desktop nav). */
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
