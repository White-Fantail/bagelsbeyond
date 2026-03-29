"use client";

import { useState, useCallback } from "react";

export interface CategoryRow {
  id: string;
  name: string;
  color: string | null;
  isVisible: boolean;
  displayOrder: number;
  updatedAt: string;
  source: string;
}

interface Props {
  initialCategories: CategoryRow[];
}

type FilterMode = "all" | "visible" | "hidden";

export default function CategoryManagerClient({ initialCategories }: Props) {
  const [categories, setCategories] = useState<CategoryRow[]>(
    [...initialCategories].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name))
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // ── Filtered view ─────────────────────────────────────────────────────────

  const filtered = categories.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ? true : filter === "visible" ? c.isVisible : !c.isVisible;
    return matchSearch && matchFilter;
  });

  // ── Toggle visibility ─────────────────────────────────────────────────────

  const toggleVisibility = useCallback(async (id: string) => {
    let newVal: boolean | undefined;

    // Optimistic update — capture the toggled value from current state
    setCategories((prev) => {
      const cat = prev.find((c) => c.id === id);
      if (!cat) return prev;
      newVal = !cat.isVisible;
      return prev.map((c) => (c.id === id ? { ...c, isVisible: newVal! } : c));
    });

    // Wait a tick so newVal is set from the state updater
    await Promise.resolve();

    if (newVal === undefined) return;

    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVisible: newVal }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      // Revert on error
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isVisible: !newVal! } : c))
      );
      setSaveMsg("❌ Failed to update visibility");
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }, []);

  // ── Move up / down ────────────────────────────────────────────────────────

  const move = useCallback((id: string, direction: "up" | "down") => {
    setCategories((prev) => {
      const arr = [...prev];
      const idx = arr.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= arr.length) return prev;
      [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
      return arr;
    });
    setDirty(true);
    setSaveMsg(null);
  }, []);

  // ── Save order ────────────────────────────────────────────────────────────

  const saveOrder = useCallback(async () => {
    setSaving(true);
    setSaveMsg(null);
    const items = categories.map((c, i) => ({ id: c.id, displayOrder: i }));
    try {
      const res = await fetch("/api/admin/categories/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error("Failed");
      // Update local displayOrder values
      setCategories((prev) =>
        prev.map((c, i) => ({ ...c, displayOrder: i }))
      );
      setDirty(false);
      setSaveMsg("✓ Order saved");
      setTimeout(() => setSaveMsg(null), 3000);
    } catch {
      setSaveMsg("❌ Failed to save order");
      setTimeout(() => setSaveMsg(null), 3000);
    } finally {
      setSaving(false);
    }
  }, [categories]);

  // ── Reset ─────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setCategories(
      [...initialCategories].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name))
    );
    setDirty(false);
    setSaveMsg(null);
  }, [initialCategories]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {(["all", "visible", "hidden"] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`px-3 py-2 capitalize transition-colors ${
                filter === mode
                  ? "bg-amber-500 text-white font-medium"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {mode === "all"
                ? `All (${categories.length})`
                : mode === "visible"
                ? `Visible (${categories.filter((c) => c.isVisible).length})`
                : `Hidden (${categories.filter((c) => !c.isVisible).length})`}
            </button>
          ))}
        </div>

        {/* Save / Reset */}
        {dirty && (
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={reset}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={saveOrder}
              disabled={saving}
              className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save Order"}
            </button>
          </div>
        )}

        {saveMsg && (
          <span className={`text-sm ml-auto ${saveMsg.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>
            {saveMsg}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[2rem_1fr_6rem_6rem_8rem_4rem] gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <span>#</span>
          <span>Name</span>
          <span>Source</span>
          <span className="text-center">Visible</span>
          <span>Last Updated</span>
          <span className="text-center">Move</span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No categories match your search or filter.
          </div>
        ) : (
          <ul role="list" className="divide-y divide-gray-100">
            {filtered.map((cat, idx) => {
              const globalIdx = categories.indexOf(cat);
              const isFirst = globalIdx === 0;
              const isLast = globalIdx === categories.length - 1;

              return (
                <li
                  key={cat.id}
                  className={`grid grid-cols-[2rem_1fr_6rem_6rem_8rem_4rem] gap-3 items-center px-4 py-3 hover:bg-gray-50 transition-colors ${
                    !cat.isVisible ? "opacity-50" : ""
                  }`}
                >
                  {/* Order number */}
                  <span className="text-xs text-gray-400 font-mono w-6 text-right">
                    {globalIdx + 1}
                  </span>

                  {/* Name */}
                  <div className="flex items-center gap-2 min-w-0">
                    {cat.color && (
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                    )}
                    <span className="font-medium text-gray-800 truncate">{cat.name}</span>
                  </div>

                  {/* Source */}
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium truncate">
                    {cat.source}
                  </span>

                  {/* Visible toggle */}
                  <div className="flex justify-center">
                    <button
                      role="switch"
                      aria-checked={cat.isVisible}
                      aria-label={`Toggle visibility for ${cat.name}`}
                      onClick={() => toggleVisibility(cat.id)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 ${
                        cat.isVisible ? "bg-amber-500" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                          cat.isVisible ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Updated at */}
                  <span className="text-xs text-gray-400 truncate">
                    {new Date(cat.updatedAt).toLocaleDateString("en-NZ", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                    })}
                  </span>

                  {/* Move up/down */}
                  <div className="flex items-center gap-0.5 justify-center">
                    <button
                      onClick={() => move(cat.id, "up")}
                      disabled={isFirst}
                      aria-label={`Move ${cat.name} up`}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => move(cat.id, "down")}
                      disabled={isLast}
                      aria-label={`Move ${cat.name} down`}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {dirty && (
        <p className="text-xs text-amber-600">
          ⚠ You have unsaved order changes. Click <strong>Save Order</strong> to persist them.
        </p>
      )}
    </div>
  );
}
