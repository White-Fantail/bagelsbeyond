"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ModifierEditForm({
  id, tracksInventory, isActive, sortOrder, sku, isLoyverseSynced,
}: {
  id: string; tracksInventory: boolean; isActive: boolean; sortOrder: number; sku: string; isLoyverseSynced: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState({ tracksInventory, isActive, sortOrder, sku });
  const [status, setStatus] = useState<"idle"|"loading"|"success"|"error">("idle");
  const [err, setErr] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading"); setErr("");
    try {
      const res = await fetch(`/api/admin/modifiers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Save Failed"); }
      setStatus("success");
      setTimeout(() => router.refresh(), 800);
    } catch (e) { setStatus("error"); setErr(e instanceof Error ? e.message : "Save Failed"); }
  };

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500";

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <h2 className="font-semibold text-gray-900">Internal Operation Settings</h2>
        {isLoyverseSynced && <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">✏️ Edit Available</span>}
      </div>
      {status === "success" && <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">✅ Saved.</div>}
      {status === "error" && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">❌ {err}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
          <input type="number" value={state.sortOrder} onChange={(e) => setState(s => ({ ...s, sortOrder: Number(e.target.value) }))} className={inp} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
          <input type="text" value={state.sku} onChange={(e) => setState(s => ({ ...s, sku: e.target.value }))} placeholder="Optional input" className={inp} />
        </div>
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={state.tracksInventory} onChange={(e) => setState(s => ({ ...s, tracksInventory: e.target.checked }))} className="w-4 h-4 rounded border-gray-300 text-amber-500" />
          <span className="text-sm font-medium text-gray-700">Inventory Tracking (tracksInventory)</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={state.isActive} onChange={(e) => setState(s => ({ ...s, isActive: e.target.checked }))} className="w-4 h-4 rounded border-gray-300 text-amber-500" />
          <span className="text-sm font-medium text-gray-700">Active Status</span>
        </label>
      </div>
      <button type="submit" disabled={status === "loading"} className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50">
        {status === "loading" ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
