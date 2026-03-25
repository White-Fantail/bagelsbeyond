"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const ROLE_OPTIONS = [
  { value: "ALL", label: "전체 권한" },
  { value: "ADMIN", label: "ADMIN" },
  { value: "STAFF", label: "STAFF" },
  { value: "CUSTOMER", label: "CUSTOMER" },
];

const ACTIVE_OPTIONS = [
  { value: "ALL", label: "전체 상태" },
  { value: "ACTIVE", label: "활성" },
  { value: "INACTIVE", label: "비활성" },
];

const SORT_OPTIONS = [
  { value: "createdAt_desc", label: "최신 가입순" },
  { value: "createdAt_asc", label: "오래된 가입순" },
  { value: "email_asc", label: "이메일 오름차순" },
  { value: "email_desc", label: "이메일 내림차순" },
  { value: "name_asc", label: "이름 오름차순" },
];

export default function UserFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [role, setRole] = useState(searchParams.get("role") ?? "ALL");
  const [isActive, setIsActive] = useState(searchParams.get("isActive") ?? "ALL");
  const [sort, setSort] = useState(searchParams.get("sort") ?? "createdAt_desc");

  const applyFilters = (overrides?: Partial<{ search: string; role: string; isActive: string; sort: string }>) => {
    const params = new URLSearchParams();
    const s = overrides?.search ?? search;
    const r = overrides?.role ?? role;
    const a = overrides?.isActive ?? isActive;
    const o = overrides?.sort ?? sort;
    if (s) params.set("search", s);
    if (r !== "ALL") params.set("role", r);
    if (a !== "ALL") params.set("isActive", a);
    if (o !== "createdAt_desc") params.set("sort", o);
    router.push("/admin/users?" + params.toString());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters();
  };

  const handleReset = () => {
    setSearch("");
    setRole("ALL");
    setIsActive("ALL");
    setSort("createdAt_desc");
    router.push("/admin/users");
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <label className="text-xs font-medium text-gray-600">이름 / 이메일 검색</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 이메일..."
            className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Role filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">권한</label>
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              applyFilters({ role: e.target.value });
            }}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
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
            className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {ACTIVE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">정렬</label>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              applyFilters({ sort: e.target.value });
            }}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
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
