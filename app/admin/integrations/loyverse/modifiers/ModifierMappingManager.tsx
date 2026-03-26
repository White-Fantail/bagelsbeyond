"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExternalOptionMapping {
  id: string;
  externalOptionId: string;
  externalName: string | null;
  externalGroupId: string | null;
  externalGroupName: string | null;
  lastSyncedAt: string | null;
}

interface InternalOption {
  id: string;
  name: string;
  priceDelta: number;
  isActive: boolean;
  tracksInventory: boolean;
  externalOptionMappings: ExternalOptionMapping[];
}

interface InternalGroup {
  id: string;
  name: string;
  product: { id: string; name: string };
  options: InternalOption[];
}

interface ExternalModifierOption {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  price: number;
}

interface ModifierMappingManagerProps {
  initialGroups: InternalGroup[];
}

// ── Filter types ──────────────────────────────────────────────────────────────

type FilterMode = "all" | "unmapped" | "tracksInventory";

// ── Component ─────────────────────────────────────────────────────────────────

export default function ModifierMappingManager({
  initialGroups,
}: ModifierMappingManagerProps) {
  const [groups, setGroups] = useState(initialGroups);
  const [externalOptions, setExternalOptions] = useState<ExternalModifierOption[]>([]);
  const [loadingExternal, setLoadingExternal] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProductId, setFilterProductId] = useState("all");
  const [isPending, startTransition] = useTransition();

  // Track which options are currently being saved
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // Track selected externalOptionId per internal option
  const [selectedExternal, setSelectedExternal] = useState<Record<string, string>>({});

  // ── Load Loyverse modifiers on mount ───────────────────────────────────────
  useEffect(() => {
    void loadExternalModifiers();
  }, []);

  async function loadExternalModifiers() {
    setLoadingExternal(true);
    try {
      const res = await fetch("/api/admin/integrations/loyverse/external-modifiers");
      if (res.ok) {
        const data = (await res.json()) as { options: ExternalModifierOption[] };
        setExternalOptions(data.options ?? []);
      }
    } catch {
      // silently handle — manual input still works
    } finally {
      setLoadingExternal(false);
    }
  }

  // ── Compute filtered groups ────────────────────────────────────────────────
  const products = Array.from(
    new Map(groups.map((g) => [g.product.id, g.product])).values()
  );

  const visibleGroups = groups
    .filter((g) => filterProductId === "all" || g.product.id === filterProductId)
    .map((g) => ({
      ...g,
      options: g.options.filter((o) => {
        if (filterMode === "unmapped" && o.externalOptionMappings.length > 0) return false;
        if (filterMode === "tracksInventory" && !o.tracksInventory) return false;
        if (
          searchQuery &&
          !o.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !g.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
          return false;
        return true;
      }),
    }))
    .filter((g) => g.options.length > 0);

  // ── Save mapping ───────────────────────────────────────────────────────────
  async function saveMapping(option: InternalOption) {
    const extId = selectedExternal[option.id];
    if (!extId) return;

    const extOption = externalOptions.find((e) => e.optionId === extId);

    setSavingIds((prev) => new Set(prev).add(option.id));
    try {
      const res = await fetch("/api/admin/integrations/loyverse/option-maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productOptionId: option.id,
          externalOptionId: extId,
          externalName: extOption?.optionName ?? null,
          externalGroupId: extOption?.groupId ?? null,
          externalGroupName: extOption?.groupName ?? null,
        }),
      });
      if (res.ok) {
        const newMapping = (await res.json()) as {
          id: string;
          externalOptionId: string;
          externalName: string | null;
          externalGroupId: string | null;
          externalGroupName: string | null;
          lastSyncedAt: string | null;
        };
        startTransition(() => {
          setGroups((prev) =>
            prev.map((g) => ({
              ...g,
              options: g.options.map((o) =>
                o.id === option.id
                  ? {
                      ...o,
                      externalOptionMappings: [
                        {
                          id: newMapping.id,
                          externalOptionId: newMapping.externalOptionId,
                          externalName: newMapping.externalName,
                          externalGroupId: newMapping.externalGroupId,
                          externalGroupName: newMapping.externalGroupName,
                          lastSyncedAt: newMapping.lastSyncedAt,
                        },
                      ],
                    }
                  : o
              ),
            }))
          );
          setSelectedExternal((prev) => {
            const next = { ...prev };
            delete next[option.id];
            return next;
          });
        });
      } else {
        const err = (await res.json()) as { error?: string };
        alert(err.error ?? "매핑 저장 실패");
      }
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(option.id);
        return next;
      });
    }
  }

  // ── Delete mapping ─────────────────────────────────────────────────────────
  async function deleteMapping(option: InternalOption, mappingId: string) {
    if (!confirm(`"${option.name}" 매핑을 해제하시겠습니까?`)) return;

    setDeletingIds((prev) => new Set(prev).add(option.id));
    try {
      const res = await fetch(
        `/api/admin/integrations/loyverse/option-maps/${mappingId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        startTransition(() => {
          setGroups((prev) =>
            prev.map((g) => ({
              ...g,
              options: g.options.map((o) =>
                o.id === option.id ? { ...o, externalOptionMappings: [] } : o
              ),
            }))
          );
        });
      } else {
        alert("매핑 해제 실패");
      }
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(option.id);
        return next;
      });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">검색</label>
          <input
            type="text"
            placeholder="옵션 또는 그룹 이름 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">표시 필터</label>
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as FilterMode)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="all">전체 보기</option>
            <option value="unmapped">미매핑만</option>
            <option value="tracksInventory">재고 추적 옵션만</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">상품별 보기</label>
          <select
            value={filterProductId}
            onChange={(e) => setFilterProductId(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="all">전체 상품</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => void loadExternalModifiers()}
          disabled={loadingExternal}
          className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 transition-colors disabled:opacity-50"
        >
          {loadingExternal ? "불러오는 중..." : "🔄 Loyverse 새로고침"}
        </button>
      </div>

      {/* Loyverse modifier status */}
      {externalOptions.length > 0 && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-sm text-blue-700">
          ✓ Loyverse에서 <strong>{externalOptions.length}개</strong>의 modifier option을
          불러왔습니다.
        </div>
      )}
      {!loadingExternal && externalOptions.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-500">
          ⚠ Loyverse modifier를 불러오지 못했습니다. 수동으로 Loyverse modifier ID를 입력하거나,
          {" "}&#8220;Loyverse 새로고침&#8221; 버튼을 눌러주세요.
        </div>
      )}

      {/* No results */}
      {visibleGroups.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">조건에 맞는 옵션이 없습니다.</p>
        </div>
      )}

      {/* Option groups */}
      {visibleGroups.map((group) => (
        <div key={group.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Group header */}
          <div className="flex items-center justify-between bg-gray-50 border-b border-gray-200 px-5 py-3">
            <div>
              <span className="font-semibold text-gray-800">{group.name}</span>
              <span className="ml-2 text-xs text-gray-400">그룹</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>상품: </span>
              <Link
                href={`/admin/products/${group.product.id}`}
                className="text-amber-600 hover:underline font-medium"
              >
                {group.product.name}
              </Link>
            </div>
          </div>

          {/* Options table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="px-5 py-2 text-left font-medium">내부 옵션</th>
                <th className="px-5 py-2 text-left font-medium">상태</th>
                <th className="px-5 py-2 text-left font-medium">Loyverse Modifier</th>
                <th className="px-5 py-2 text-left font-medium">마지막 동기화</th>
                <th className="px-5 py-2 text-left font-medium">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {group.options.map((option) => {
                const mapping = option.externalOptionMappings[0];
                const isMapped = Boolean(mapping);
                const isSaving = savingIds.has(option.id);
                const isDeleting = deletingIds.has(option.id);

                return (
                  <tr
                    key={option.id}
                    className={`${!option.isActive ? "opacity-50" : ""} hover:bg-gray-50`}
                  >
                    {/* Internal option info */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{option.name}</span>
                        {option.tracksInventory && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                            재고추적
                          </span>
                        )}
                        {!option.isActive && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                            비활성
                          </span>
                        )}
                      </div>
                      {option.priceDelta !== 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {option.priceDelta > 0 ? "+" : ""}
                          {option.priceDelta.toFixed(2)}
                        </p>
                      )}
                    </td>

                    {/* Mapping status badge */}
                    <td className="px-5 py-3">
                      {isMapped ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          ✓ 매핑됨
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                          ✗ 미매핑
                        </span>
                      )}
                    </td>

                    {/* Loyverse modifier info / selector */}
                    <td className="px-5 py-3">
                      {isMapped && mapping ? (
                        <div>
                          <p className="font-medium text-gray-800">
                            {mapping.externalName ?? mapping.externalOptionId}
                          </p>
                          {mapping.externalGroupName && (
                            <p className="text-xs text-gray-400">{mapping.externalGroupName}</p>
                          )}
                          <p className="text-xs text-gray-400 font-mono mt-0.5">
                            {mapping.externalOptionId}
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {externalOptions.length > 0 ? (
                            <select
                              value={selectedExternal[option.id] ?? ""}
                              onChange={(e) =>
                                setSelectedExternal((prev) => ({
                                  ...prev,
                                  [option.id]: e.target.value,
                                }))
                              }
                              className="rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 max-w-[260px]"
                            >
                              <option value="">-- Loyverse modifier 선택 --</option>
                              {externalOptions.map((ext) => (
                                <option key={ext.optionId} value={ext.optionId}>
                                  [{ext.groupName}] {ext.optionName}
                                  {ext.price > 0 ? ` +$${ext.price}` : ""}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              placeholder="Loyverse modifier option ID 입력..."
                              value={selectedExternal[option.id] ?? ""}
                              onChange={(e) =>
                                setSelectedExternal((prev) => ({
                                  ...prev,
                                  [option.id]: e.target.value,
                                }))
                              }
                              className="rounded border border-gray-200 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-400 max-w-[260px]"
                            />
                          )}
                        </div>
                      )}
                    </td>

                    {/* Last synced */}
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {mapping?.lastSyncedAt
                        ? new Date(mapping.lastSyncedAt).toLocaleString("ko-KR")
                        : "-"}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3">
                      {isMapped && mapping ? (
                        <div className="flex items-center gap-2">
                          {/* Remap: clear existing mapping to re-select */}
                          <button
                            onClick={() => {
                              startTransition(() => {
                                setGroups((prev) =>
                                  prev.map((g) => ({
                                    ...g,
                                    options: g.options.map((o) =>
                                      o.id === option.id
                                        ? { ...o, externalOptionMappings: [] }
                                        : o
                                    ),
                                  }))
                                );
                              });
                            }}
                            className="px-2 py-1 text-xs rounded border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => void deleteMapping(option, mapping.id)}
                            disabled={isDeleting}
                            className="px-2 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            {isDeleting ? "..." : "해제"}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => void saveMapping(option)}
                          disabled={isSaving || !selectedExternal[option.id] || isPending}
                          className="px-3 py-1 text-xs rounded bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-40"
                        >
                          {isSaving ? "저장 중..." : "매핑 저장"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
