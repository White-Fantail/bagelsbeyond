"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

interface CatalogSearchFilterProps {
  basePath: string;
  placeholder?: string;
  extraFilters?: React.ReactNode;
}

export default function CatalogSearchFilter({
  basePath,
  placeholder = "Search…",
  extraFilters,
}: CatalogSearchFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  function applyFilters(overrides?: { search?: string }) {
    const params = new URLSearchParams();
    const s = overrides?.search ?? search;
    if (s) params.set("search", s);
    router.push(basePath + (params.toString() ? "?" + params.toString() : ""));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    applyFilters();
  }

  function handleReset() {
    setSearch("");
    router.push(basePath);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <label className="text-xs font-medium text-gray-600">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {extraFilters}

        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            Search
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </form>
  );
}
