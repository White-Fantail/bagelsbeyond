"use client";

import { useState, useEffect, useCallback } from "react";

type InventoryRow = {
  productId: string;
  productName: string;
  category: string;
  plannedQty: number;
  bakedQty: number;
  reservedQty: number;
  soldQty: number;
  isSoldOut: boolean;
  note: string;
  existingId: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  BAGEL: "베이글",
  SANDWICH: "샌드위치",
  SPREAD: "스프레드",
  DRINK: "음료",
  OTHER: "기타",
};

const CATEGORY_COLORS: Record<string, string> = {
  BAGEL: "bg-amber-100 text-amber-700",
  SANDWICH: "bg-green-100 text-green-700",
  SPREAD: "bg-orange-100 text-orange-700",
  DRINK: "bg-blue-100 text-blue-700",
  OTHER: "bg-gray-100 text-gray-600",
};

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100 animate-pulse">
      <td className="px-4 py-3">
        <div className="h-4 bg-gray-200 rounded w-28 mb-1" />
        <div className="h-3 bg-gray-100 rounded w-14" />
      </td>
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-8 bg-gray-200 rounded w-16" />
        </td>
      ))}
      <td className="px-4 py-3">
        <div className="h-8 bg-gray-200 rounded w-6 mx-auto" />
      </td>
      <td className="px-4 py-3">
        <div className="h-8 bg-gray-200 rounded w-full" />
      </td>
      <td className="px-4 py-3">
        <div className="h-8 bg-gray-200 rounded w-14" />
      </td>
    </tr>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-5 bg-gray-200 rounded w-24" />
        <div className="h-5 bg-gray-100 rounded w-14" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="h-3 bg-gray-100 rounded w-16" />
            <div className="h-8 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
      <div className="h-8 bg-gray-200 rounded" />
      <div className="h-9 bg-amber-100 rounded" />
    </div>
  );
}

export default function InventoryManager() {
  const [date, setDate] = useState<string>(() =>
    new Date().toLocaleDateString("en-CA")
  );
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const fetchInventory = useCallback(async (d: string) => {
    setLoading(true);
    setFetchError(null);
    setSavedIds(new Set());
    setRowErrors({});
    try {
      const res = await fetch(`/api/admin/inventory?date=${d}`);
      const data = await res.json();
      if (!res.ok) {
        setFetchError(data.message ?? "재고 정보를 불러오는데 실패했습니다");
        setRows([]);
        return;
      }
      const items: Array<{
        product: { id: string; name: string; category: string };
        dailyInventory: {
          id: string;
          plannedQty: number;
          bakedQty: number;
          reservedQty: number;
          soldQty: number;
          isSoldOut: boolean;
          note: string | null;
        } | null;
      }> = data.inventory ?? [];

      setRows(
        items.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          category: item.product.category,
          plannedQty: item.dailyInventory?.plannedQty ?? 0,
          bakedQty: item.dailyInventory?.bakedQty ?? 0,
          reservedQty: item.dailyInventory?.reservedQty ?? 0,
          soldQty: item.dailyInventory?.soldQty ?? 0,
          isSoldOut: item.dailyInventory?.isSoldOut ?? false,
          note: item.dailyInventory?.note ?? "",
          existingId: item.dailyInventory?.id ?? null,
        }))
      );
    } catch {
      setFetchError("서버 연결에 실패했습니다");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory(date);
  }, [date, fetchInventory]);

  function updateRow(productId: string, patch: Partial<InventoryRow>) {
    setRows((prev) =>
      prev.map((r) => (r.productId === productId ? { ...r, ...patch } : r))
    );
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.delete(productId);
      return next;
    });
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }

  async function handleSave(row: InventoryRow) {
    setSavingId(row.productId);
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[row.productId];
      return next;
    });
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.delete(row.productId);
      return next;
    });

    try {
      const res = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: row.productId,
          date,
          plannedQty: row.plannedQty,
          bakedQty: row.bakedQty,
          reservedQty: row.reservedQty,
          soldQty: row.soldQty,
          isSoldOut: row.isSoldOut,
          note: row.note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRowErrors((prev) => ({
          ...prev,
          [row.productId]: data.message ?? "저장에 실패했습니다",
        }));
      } else {
        setSavedIds((prev) => new Set(prev).add(row.productId));
        if (data.dailyInventory?.id) {
          setRows((prev) =>
            prev.map((r) =>
              r.productId === row.productId
                ? { ...r, existingId: data.dailyInventory.id }
                : r
            )
          );
        }
      }
    } catch {
      setRowErrors((prev) => ({
        ...prev,
        [row.productId]: "서버 연결에 실패했습니다",
      }));
    } finally {
      setSavingId(null);
    }
  }

  function numInput(
    row: InventoryRow,
    field: keyof Pick<InventoryRow, "plannedQty" | "bakedQty" | "reservedQty" | "soldQty">,
    readOnly = false
  ) {
    return (
      <input
        type="number"
        min={0}
        value={row[field]}
        readOnly={readOnly}
        onChange={
          readOnly
            ? undefined
            : (e) =>
                updateRow(row.productId, {
                  [field]: Math.max(0, parseInt(e.target.value, 10) || 0),
                })
        }
        className={`w-16 border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition ${
          readOnly
            ? "bg-gray-50 text-gray-400 cursor-default border-gray-100"
            : "border-gray-200 bg-white hover:border-amber-300"
        }`}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Date picker */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
        <label
          htmlFor="inv-date"
          className="text-sm font-medium text-gray-700 whitespace-nowrap"
        >
          조회 날짜
        </label>
        <input
          id="inv-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent hover:border-amber-300 transition"
        />
        <span className="text-xs text-gray-400">
          날짜를 변경하면 해당 날짜의 재고 현황이 자동으로 불러와집니다.
        </span>
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">상품명</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">
                  계획수량
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">
                  생산수량
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">
                  <span className="block">예약수량</span>
                  <span className="text-xs font-normal text-gray-400">향후 자동 계산</span>
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">
                  판매수량
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">품절</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">비고</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">저장</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-gray-400 text-sm"
                  >
                    등록된 상품이 없습니다. 먼저 상품을 추가해주세요.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isSaving = savingId === row.productId;
                  const isSaved = savedIds.has(row.productId);
                  const rowError = rowErrors[row.productId];
                  return (
                    <tr
                      key={row.productId}
                      className="border-b border-gray-100 last:border-0 hover:bg-amber-50/30 transition-colors"
                    >
                      {/* Product name */}
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">
                          {row.productName}
                        </span>
                        <span
                          className={`ml-2 inline-block text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            CATEGORY_COLORS[row.category] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {CATEGORY_LABELS[row.category] ?? row.category}
                        </span>
                      </td>
                      {/* plannedQty */}
                      <td className="px-4 py-3 text-center">
                        {numInput(row, "plannedQty")}
                      </td>
                      {/* bakedQty */}
                      <td className="px-4 py-3 text-center">
                        {numInput(row, "bakedQty")}
                      </td>
                      {/* reservedQty – read-only */}
                      <td className="px-4 py-3 text-center">
                        {numInput(row, "reservedQty", true)}
                      </td>
                      {/* soldQty */}
                      <td className="px-4 py-3 text-center">
                        {numInput(row, "soldQty")}
                      </td>
                      {/* isSoldOut */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={row.isSoldOut}
                          onChange={(e) =>
                            updateRow(row.productId, {
                              isSoldOut: e.target.checked,
                            })
                          }
                          className="w-4 h-4 accent-amber-500 cursor-pointer"
                        />
                      </td>
                      {/* note */}
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={row.note}
                          placeholder="선택 사항"
                          onChange={(e) =>
                            updateRow(row.productId, { note: e.target.value })
                          }
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent hover:border-amber-300 transition min-w-[120px]"
                        />
                      </td>
                      {/* save */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <button
                            onClick={() => handleSave(row)}
                            disabled={isSaving || savingId !== null}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 text-white text-xs font-semibold rounded-lg transition whitespace-nowrap"
                          >
                            {isSaving ? "저장 중…" : "저장"}
                          </button>
                          {isSaved && (
                            <span className="text-xs text-green-600 font-medium">
                              ✓ 저장됨
                            </span>
                          )}
                          {rowError && (
                            <span className="text-xs text-red-500 max-w-[100px] text-center">
                              {rowError}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-12 text-center text-gray-400 text-sm">
            등록된 상품이 없습니다. 먼저 상품을 추가해주세요.
          </div>
        ) : (
          rows.map((row) => {
            const isSaving = savingId === row.productId;
            const isSaved = savedIds.has(row.productId);
            const rowError = rowErrors[row.productId];
            return (
              <div
                key={row.productId}
                className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
              >
                {/* Header */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">
                    {row.productName}
                  </span>
                  <span
                    className={`inline-block text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      CATEGORY_COLORS[row.category] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {CATEGORY_LABELS[row.category] ?? row.category}
                  </span>
                </div>

                {/* Qty grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500 font-medium">계획수량</label>
                    <input
                      type="number"
                      min={0}
                      value={row.plannedQty}
                      onChange={(e) =>
                        updateRow(row.productId, {
                          plannedQty: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent hover:border-amber-300 transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500 font-medium">생산수량</label>
                    <input
                      type="number"
                      min={0}
                      value={row.bakedQty}
                      onChange={(e) =>
                        updateRow(row.productId, {
                          bakedQty: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent hover:border-amber-300 transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500 font-medium">
                      예약수량
                      <span className="ml-1 text-gray-400 font-normal">(자동)</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={row.reservedQty}
                      readOnly
                      className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-default"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500 font-medium">판매수량</label>
                    <input
                      type="number"
                      min={0}
                      value={row.soldQty}
                      onChange={(e) =>
                        updateRow(row.productId, {
                          soldQty: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent hover:border-amber-300 transition"
                    />
                  </div>
                </div>

                {/* Sold out + note */}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={row.isSoldOut}
                      onChange={(e) =>
                        updateRow(row.productId, { isSoldOut: e.target.checked })
                      }
                      className="w-4 h-4 accent-amber-500"
                    />
                    <span className="text-sm text-gray-700">품절</span>
                  </label>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-medium">비고</label>
                  <input
                    type="text"
                    value={row.note}
                    placeholder="선택 사항"
                    onChange={(e) =>
                      updateRow(row.productId, { note: e.target.value })
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent hover:border-amber-300 transition"
                  />
                </div>

                {/* Save button */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleSave(row)}
                    disabled={isSaving || savingId !== null}
                    className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 text-white text-sm font-semibold rounded-lg transition"
                  >
                    {isSaving ? "저장 중…" : "저장"}
                  </button>
                  {isSaved && (
                    <span className="text-sm text-green-600 font-medium">✓ 저장됨</span>
                  )}
                  {rowError && (
                    <span className="text-sm text-red-500">{rowError}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
