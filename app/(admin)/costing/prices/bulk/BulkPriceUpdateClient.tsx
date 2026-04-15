"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { UnitType } from "@/app/generated/prisma/enums";
import type { IngredientRow } from "@/lib/services/ingredientService";

const UNIT_OPTIONS = Object.values(UnitType);

type EditState = {
  purchasePrice: string;
  purchaseQuantity: string;
  purchaseUnit: string;
};

type RowError = { ingredientId: string; message: string };

type SaveResult = {
  updatedCount: number;
  skippedCount: number;
  errors: RowError[];
} | null;

export default function BulkPriceUpdateClient({ ingredients }: { ingredients: IngredientRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [note, setNote] = useState("");
  const [saveResult, setSaveResult] = useState<SaveResult>(null);

  const filtered = useMemo(
    () => ingredients.filter((ing) => ing.name.toLowerCase().includes(search.toLowerCase())),
    [ingredients, search]
  );

  const changedIds = Object.keys(edits);
  const changedCount = changedIds.length;

  function handleEdit(id: string, field: keyof EditState, value: string) {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...getEdit(id, ingredients.find((i) => i.id === id)!), [field]: value },
    }));
    setRowErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setSaveResult(null);
  }

  function getEdit(id: string, ing: IngredientRow): EditState {
    return (
      edits[id] ?? {
        purchasePrice: ing.purchasePrice,
        purchaseQuantity: ing.purchaseQuantity,
        purchaseUnit: ing.purchaseUnit,
      }
    );
  }

  function resetRow(id: string) {
    setEdits((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setRowErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }

  function isChanged(id: string, ing: IngredientRow): boolean {
    const edit = edits[id];
    if (!edit) return false;
    return (
      edit.purchasePrice !== ing.purchasePrice ||
      edit.purchaseQuantity !== ing.purchaseQuantity ||
      edit.purchaseUnit !== ing.purchaseUnit
    );
  }

  function handleSave() {
    const items = changedIds
      .map((id) => {
        const ing = ingredients.find((i) => i.id === id);
        if (!ing) return null;
        const edit = edits[id];
        return {
          ingredientId: id,
          purchasePrice: parseFloat(edit.purchasePrice),
          purchaseQuantity: parseFloat(edit.purchaseQuantity),
          purchaseUnit: edit.purchaseUnit as UnitType,
          baseUnit: ing.baseUnit as UnitType,
          effectiveFrom: effectiveFrom || null,
          changeNote: note || null,
        };
      })
      .filter(Boolean);

    if (items.length === 0) return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/ingredients/bulk-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
        const data = await res.json();
        if (!res.ok) {
          setSaveResult({ updatedCount: 0, skippedCount: 0, errors: [{ ingredientId: "", message: data.message ?? "Failed" }] });
          return;
        }
        const result = data.result as SaveResult;
        setSaveResult(result);
        if (result) {
          const errMap: Record<string, string> = {};
          result.errors.forEach((e) => { if (e.ingredientId) errMap[e.ingredientId] = e.message; });
          setRowErrors(errMap);
          // Clear successfully updated rows
          if (result.updatedCount > 0) {
            setEdits((prev) => {
              const next = { ...prev };
              changedIds.forEach((id) => { if (!errMap[id]) delete next[id]; });
              return next;
            });
            router.refresh();
          }
        }
      } catch {
        setSaveResult({ updatedCount: 0, skippedCount: 0, errors: [{ ingredientId: "", message: "Network error" }] });
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Effective From</label>
            <input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Change Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Supplier price increase"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ingredients…"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 w-full sm:w-72"
          />
          <button
            onClick={handleSave}
            disabled={changedCount === 0 || isPending}
            className="px-4 py-2 rounded-lg bg-amber-500 text-white font-medium text-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? "Saving…" : `Save ${changedCount > 0 ? `${changedCount} Change${changedCount !== 1 ? "s" : ""}` : "Changes"}`}
          </button>
        </div>
      </div>

      {/* Save result */}
      {saveResult && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${saveResult.errors.length > 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"}`}>
          {saveResult.updatedCount > 0 && <span>{saveResult.updatedCount} ingredient{saveResult.updatedCount !== 1 ? "s" : ""} updated. </span>}
          {saveResult.errors.length > 0 && (
            <span>{saveResult.errors.length} error{saveResult.errors.length !== 1 ? "s" : ""}: {saveResult.errors.filter((e) => !e.ingredientId).map((e) => e.message).join("; ")}</span>
          )}
          {saveResult.updatedCount > 0 && saveResult.errors.length === 0 && <span>All changes saved successfully.</span>}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Current Price</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">New Price</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">New Qty</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">New Unit</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No ingredients found</td>
                </tr>
              )}
              {filtered.map((ing) => {
                const edit = getEdit(ing.id, ing);
                const changed = isChanged(ing.id, ing);
                const err = rowErrors[ing.id];
                return (
                  <tr key={ing.id} className={changed ? "bg-amber-50" : ""}>
                    <td className="px-4 py-2 font-medium text-gray-800">{ing.name}</td>
                    <td className="px-4 py-2 text-right text-gray-500">
                      ${ing.purchasePrice} / {ing.purchaseQuantity} {ing.purchaseUnit}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={edit.purchasePrice}
                        onChange={(e) => handleEdit(ing.id, "purchasePrice", e.target.value)}
                        className={`w-24 border rounded px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${err ? "border-red-400" : "border-gray-300"}`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={edit.purchaseQuantity}
                        onChange={(e) => handleEdit(ing.id, "purchaseQuantity", e.target.value)}
                        className={`w-20 border rounded px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${err ? "border-red-400" : "border-gray-300"}`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={edit.purchaseUnit}
                        onChange={(e) => handleEdit(ing.id, "purchaseUnit", e.target.value)}
                        className={`border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${err ? "border-red-400" : "border-gray-300"}`}
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      {err ? (
                        <span className="text-xs text-red-600">{err}</span>
                      ) : changed ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium">Edited</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {changed && (
                        <button
                          onClick={() => resetRow(ing.id)}
                          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          Reset
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
