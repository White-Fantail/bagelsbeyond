/**
 * Role-based navigation configuration.
 *
 * Each role gets its own sidebar menu:
 *  - PUBLIC   : unauthenticated users — CTA-focused, no internal menus
 *  - CUSTOMER : order/account-centric (고객 메뉴)
 *  - STAFF    : day-to-day operations only — no analytics/data/admin menus
 *  - ADMIN    : full grouped sidebar with all sections
 *
 * Adding a new menu item:
 *  1. Add the item to the appropriate role config below.
 *  2. The sidebar components pick it up automatically.
 *
 * Route areas:
 *  Public    : /  /order  /subscribe  /login  /signup
 *  Customer  : /account/**
 *  Staff     : /staff  /admin/orders  /admin/subscriptions  /sales  /calendar  /admin/inventory
 *  Admin     : /admin/**  /analytics  /weights  /settings  /imports  /external-factors  /tasks
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
    label: "메뉴",
    items: [
      { href: "/", label: "홈" },
      { href: "/order", label: "주문하기" },
      { href: "/subscribe", label: "구독" },
    ],
  },
];

// ── Customer (USER) ───────────────────────────────────────────────────────────

export const CUSTOMER_NAV: RoleNavConfig = {
  dashboardHref: "/account",
  dashboardLabel: "내 계정",
  groups: [
    {
      id: "customer",
      label: "고객 메뉴",
      items: [
        { href: "/", label: "홈" },
        { href: "/order", label: "메뉴 / 주문" },
        { href: "/account/subscriptions", label: "구독 관리" },
        { href: "/account/orders", label: "내 주문" },
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
      id: "dashboard",
      label: "대시보드",
      items: [{ href: "/staff", label: "운영 대시보드" }],
    },
    {
      id: "orders",
      label: "주문 / 구독",
      items: [
        { href: "/admin/orders", label: "주문 관리" },
        { href: "/admin/subscriptions", label: "구독 관리" },
        { href: "/admin/sync/orders", label: "주문 자동 전송 현황" },
      ],
    },
    {
      id: "sales",
      label: "매출",
      items: [
        { href: "/sales/new", label: "매출 입력" },
        { href: "/sales", label: "매출 목록" },
        { href: "/calendar", label: "달력" },
      ],
    },
    {
      id: "inventory",
      label: "재고",
      items: [{ href: "/admin/inventory", label: "재고 관리" }],
    },
  ],
};

// ── Admin ─────────────────────────────────────────────────────────────────────

export const ADMIN_NAV: RoleNavConfig = {
  dashboardHref: "/admin",
  dashboardLabel: "관리자 대시보드",
  groups: [
    {
      id: "dashboard",
      label: "대시보드",
      items: [{ href: "/admin", label: "운영 대시보드" }],
    },
    {
      id: "products",
      label: "상품 / 재고",
      items: [
        { href: "/admin/products", label: "상품 관리" },
        { href: "/admin/inventory", label: "재고 관리" },
      ],
    },
    {
      id: "orders",
      label: "주문 / 구독",
      items: [
        { href: "/admin/orders", label: "주문 관리" },
        { href: "/admin/subscriptions", label: "구독 관리" },
        { href: "/admin/subscription-occurrences", label: "구독 플랜 관리" },
      ],
    },
    {
      id: "sales",
      label: "매출",
      items: [
        { href: "/calendar", label: "달력" },
        { href: "/sales/new", label: "매출 입력" },
        { href: "/sales", label: "매출 목록" },
      ],
    },
    {
      id: "analytics",
      label: "분석 / 예측",
      items: [
        { href: "/analytics", label: "매출 분석" },
        { href: "/analytics/weekly", label: "요일별 분석" },
        { href: "/predictions", label: "매출 예측" },
        { href: "/weights", label: "가중치 관리" },
        { href: "/predictions/performance", label: "성과 분석" },
      ],
    },
    {
      id: "data",
      label: "데이터",
      items: [
        { href: "/imports", label: "가져오기" },
        { href: "/external-factors", label: "외부 데이터" },
        { href: "/tasks", label: "자동화" },
      ],
    },
    {
      id: "admin",
      label: "관리자",
      items: [
        { href: "/admin/users", label: "사용자 관리" },
        { href: "/admin/sync/orders", label: "주문 자동 전송 현황" },
        { href: "/admin/integrations", label: "외부 연동" },
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
