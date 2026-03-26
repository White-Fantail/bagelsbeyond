"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const CATEGORY_OPTIONS = [
  { value: "ALL", label: "전체 카테고리" },
  { value: "BAGEL", label: "베이글" },
  { value: "SANDWICH", label: "샌드위치" },
  { value: "SPREAD", label: "스프레드" },
  { value: "DRINK", label: "음료" },
  { value: "OTHER", label: "기타" },
];

const SOURCE_OPTIONS = [
  { value: "ALL", label: "전체 출처" },
  { value: "LOYVERSE", label: "Loyverse Sync" },
  { value: "INTERNAL", label: "내부 생성" },
];

const ACTIVE_OPTIONS = [
  { value: "ALL", label: "전체 상태" },
  { value: "ACTIVE", label: "활성" },
  { value: "INACTIVE", label: "비활성" },
];

const SUBSCRIPTION_OPTIONS = [
  { value: "ALL", label: "구독 여부 전체" },
  { value: "YES", label: "구독 가능" },
  { value: "NO", label: "구독 불가" },
];

export default function ProductFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "ALL");
  const [source, setSource] = useState(searchParams.get("source") ?? "ALL");
  const [isActive, setIsActive] = useState(searchParams.get("isActive") ?? "ALL");
  const [subscription, setSubscription] = useState(searchParams.get("subscription") ?? "ALL");

  const applyFilters = (
    overrides?: Partial<{
      search: string;
      category: string;
      source: string;
      isActive: string;
      subscription: string;
    }>
  ) => {
    const params = new URLSearchParams();
    const s = overrides?.search ?? search;
    const c = overrides?.category ?? category;
    const src = overrides?.source ?? source;
    const a = overrides?.isActive ?? isActive;
    const sub = overrides?.subscription ?? subscription;
    if (s) params.set("search", s);
    if (c !== "ALL") params.set("category", c);
    if (src !== "ALL") params.set("source", src);
    if (a !== "ALL") params.set("isActive", a);
    if (sub !== "ALL") params.set("subscription", sub);
    router.push("/admin/products?" + params.toString());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters();
  };

  const handleReset = () => {
    setSearch("");
    setCategory("ALL");
    setSource("ALL");
    setIsActive("ALL");
    setSubscription("ALL");
    router.push("/admin/products");
  };

  const selectClass =
    "px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500";

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <label className="text-xs font-medium text-gray-600">이름 검색</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="상품명 검색..."
            className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Category filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">카테고리</label>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              applyFilters({ category: e.target.value });
            }}
            className={selectClass}
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Source filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">출처</label>
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              applyFilters({ source: e.target.value });
            }}
            className={selectClass}
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Active filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">활성 상태</label>
          <select
            value={isActive}
            onChange={(e) => {
              setIsActive(e.target.value);
              applyFilters({ isActive: e.target.value });
            }}
            className={selectClass}
          >
            {ACTIVE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Subscription filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">구독</label>
          <select
            value={subscription}
            onChange={(e) => {
              setSubscription(e.target.value);
              applyFilters({ subscription: e.target.value });
            }}
            className={selectClass}
          >
            {SUBSCRIPTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            검색
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            초기화
          </button>
        </div>
      </div>
    </form>
  );
}
