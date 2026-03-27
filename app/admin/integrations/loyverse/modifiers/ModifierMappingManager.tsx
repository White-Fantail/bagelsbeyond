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
  product: { id: string; name: string } | null;
  options: InternalOption[];
}

interface ExternalModifierOption {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  price: number;
}

/** Metadata from the last modifier sync attempt (from LoyverseModifierSyncLog) */
interface ModifierSyncMeta {
  status: "success" | "empty" | "failed" | "never";
  syncedAt: string | null;
  groupCount: number;
  optionCount: number;
  errorMessage?: string;
  errorCode?: number;
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
  const [syncingModifiers, setSyncingModifiers] = useState(false);
  const [syncMeta, setSyncMeta] = useState<ModifierSyncMeta | null>(null);
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProductId, setFilterProductId] = useState("all");
  const [isPending, startTransition] = useTransition();

  // Track which options are currently being saved
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // Track selected externalOptionId per internal option
  const [selectedExternal, setSelectedExternal] = useState<Record<string, string>>({});

  // ── Load stored Loyverse modifiers on mount ────────────────────────────────
  useEffect(() => {
    void loadExternalModifiers();
  }, []);

  /** Load modifier data from the stored sync log (does NOT call Loyverse live). */
  async function loadExternalModifiers() {
    setLoadingExternal(true);
    try {
      const res = await fetch("/api/admin/integrations/loyverse/external-modifiers");
      if (res.ok) {
        const data = (await res.json()) as {
          options: ExternalModifierOption[];
          sync: ModifierSyncMeta;
        };
        setExternalOptions(data.options ?? []);
        setSyncMeta(data.sync ?? null);
      } else {
        setSyncMeta({
          status: "failed",
          syncedAt: new Date().toISOString(),
          groupCount: 0,
          optionCount: 0,
          errorMessage: `서버 오류 (HTTP ${res.status})`,
        });
      }
    } catch (err) {
      setSyncMeta({
        status: "failed",
        syncedAt: new Date().toISOString(),
        groupCount: 0,
        optionCount: 0,
        errorMessage: err instanceof Error ? err.message : "알 수 없는 오류",
      });
    } finally {
      setLoadingExternal(false);
    }
  }

  /** Trigger a live Loyverse modifier sync and reload data. */
  async function syncModifiers() {
    setSyncingModifiers(true);
    try {
      const res = await fetch("/api/admin/integrations/loyverse/modifier-sync", {
        method: "POST",
      });
      const data = (await res.json()) as ModifierSyncMeta & { syncedAt: string };
      setSyncMeta({
        status: data.status,
        syncedAt: data.syncedAt ?? new Date().toISOString(),
        groupCount: data.groupCount ?? 0,
        optionCount: data.optionCount ?? 0,
        errorMessage: data.errorMessage,
        errorCode: data.errorCode,
      });
      await loadExternalModifiers();
    } catch (err) {
      setSyncMeta({
        status: "failed",
        syncedAt: new Date().toISOString(),
        groupCount: 0,
        optionCount: 0,
        errorMessage: err instanceof Error ? err.message : "알 수 없는 오류",
      });
    } finally {
      setSyncingModifiers(false);
    }
  }

  async function saveMapping(option: InternalOption) {
    const externalOptionId = selectedExternal[option.id];
    if (!externalOptionId) return;
    setSavingIds((prev) => new Set(prev).add(option.id));
    try {
      const externalOpt = externalOptions.find((e) => e.optionId === externalOptionId);
      const res = await fetch("/api/admin/integrations/loyverse/option-maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productOptionId: option.id,
          externalOptionId,
          externalName: externalOpt?.optionName ?? null,
          externalGroupId: externalOpt?.groupId ?? null,
          externalGroupName: externalOpt?.groupName ?? null,
        }),
      });
      if (res.ok) {
        const saved = (await res.json()) as {
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
                          id: saved.id,
                          externalOptionId: saved.externalOptionId,
                          externalName: saved.externalName,
                          externalGroupId: saved.externalGroupId,
                          externalGroupName: saved.externalGroupName,
                          lastSyncedAt: saved.lastSyncedAt,
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
      }
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(option.id);
        return next;
      });
    }
  }

  async function deleteMapping(option: InternalOption, mappingId: string) {
    setDeletingIds((prev) => new Set(prev).add(option.id));
    try {
      const res = await fetch(`/api/admin/integrations/loyverse/option-maps/${mappingId}`, {
        method: "DELETE",
      });
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
      }
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(option.id);
        return next;
      });
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────────

  const allProducts = Array.from(
    new Map(
      groups
        .filter((g) => g.product)
        .map((g) => [g.product!.id, g.product!])
    ).values()
  );

  const filteredGroups = groups.filter((g) => {
    if (filterProductId !== "all" && g.product?.id !== filterProductId) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <ModifierSyncStatusPanel
        syncMeta={syncMeta}
        loading={loadingExternal || syncingModifiers}
        onRefresh={() => void syncModifiers()}
        showManualFallback={showManualFallback}
        onToggleManualFallback={() => setShowManualFallback((v) => !v)}
      />

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="옵션 이름 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <select
          value={filterProductId}
          onChange={(e) => setFilterProductId(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="all">전체 상품</option>
          {allProducts.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {(["all", "unmapped", "tracksInventory"] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterMode(mode)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                filterMode === mode
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {mode === "all" ? "전체" : mode === "unmapped" ? "미매핑" : "재고 추적"}
            </button>
          ))}
        </div>
      </div>

      {/* Groups */}
      {filteredGroups.map((group) => (
        <div key={group.id} className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
            <span className="font-semibold text-sm text-gray-900">{group.name}</span>
            {group.product && (
              <Link
                href={`/admin/products/${group.product.id}`}
                className="text-xs text-amber-600 hover:underline"
              >
                {group.product.name}
              </Link>
            )}
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-5 py-2 text-xs font-medium text-gray-500">옵션</th>
                <th className="px-5 py-2 text-xs font-medium text-gray-500">Loyverse Modifier</th>
                <th className="px-5 py-2 text-xs font-medium text-gray-500">마지막 동기화</th>
                <th className="px-5 py-2 text-xs font-medium text-gray-500">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {group.options.map((option) => {
                const useManual = showManualFallback;
                const isMapped = option.externalOptionMappings.length > 0;
                const mapping = option.externalOptionMappings[0] ?? null;
                const isSaving = savingIds.has(option.id);
                const isDeleting = deletingIds.has(option.id);
                if (filterMode === "unmapped" && isMapped) return null;
                if (filterMode === "tracksInventory" && !option.tracksInventory) return null;
                if (
                  searchQuery &&
                  !option.name.toLowerCase().includes(searchQuery.toLowerCase())
                )
                  return null;

                return (
                  <tr key={option.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-gray-900">{option.name}</span>
                        {option.priceDelta !== 0 && (
                          <span className="text-xs text-gray-400">
                            {option.priceDelta > 0 ? "+" : ""}${option.priceDelta}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {isMapped ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-mono text-gray-700">
                            {mapping?.externalOptionId}
                          </span>
                          {mapping?.externalName && (
                            <span className="text-xs text-gray-400">{mapping.externalName}</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {!useManual ? (
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

// ── ModifierSyncStatusPanel ────────────────────────────────────────────────────
// Displays the current modifier sync state with specific error messages and a
// refresh button.  The panel is shown above the mapping table.

function ModifierSyncStatusPanel({
  syncMeta,
  loading,
  onRefresh,
  showManualFallback,
  onToggleManualFallback,
}: {
  syncMeta: ModifierSyncMeta | null;
  loading: boolean;
  onRefresh: () => void;
  showManualFallback: boolean;
  onToggleManualFallback: () => void;
}) {
  const syncedAtLabel = syncMeta?.syncedAt
    ? new Date(syncMeta.syncedAt).toLocaleString("ko-KR")
    : null;

  // ── Human-readable error message ─────────────────────────────────────────
  function errorLabel(meta: ModifierSyncMeta): string {
    if (meta.status === "never") return "아직 modifier 동기화가 실행된 적 없습니다.";
    if (meta.status === "empty") return "Loyverse modifier API 응답이 비어 있습니다. (modifier 0개)";
    if (meta.status !== "failed") return "";

    const code = meta.errorCode;
    if (code === 401 || code === 403) return `Loyverse 인증 실패 (HTTP ${code}) — LOYVERSE_API_TOKEN을 확인하세요.`;
    if (code === 404) return `Modifier 엔드포인트를 찾을 수 없습니다 (HTTP 404).`;
    if (code === 429) return "Loyverse API 요청 한도 초과 (HTTP 429) — 잠시 후 다시 시도하세요.";
    if (code && code >= 500) return `Loyverse 서버 오류 (HTTP ${code}) — 잠시 후 다시 시도하세요.`;
    if (meta.errorMessage?.toLowerCase().includes("parse") || meta.errorMessage?.toLowerCase().includes("json"))
      return `Modifier 응답 파싱에 실패했습니다: ${meta.errorMessage}`;
    if (meta.errorMessage?.toLowerCase().includes("network") || meta.errorMessage?.toLowerCase().includes("fetch"))
      return `네트워크 오류로 Loyverse에 연결할 수 없습니다: ${meta.errorMessage}`;
    return meta.errorMessage ?? "알 수 없는 오류가 발생했습니다.";
  }

  const isSuccess = syncMeta?.status === "success";
  const isNeverOrEmpty = syncMeta === null || syncMeta.status === "never" || syncMeta.status === "empty";
  const isFailed = syncMeta?.status === "failed";

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 ${
        isSuccess
          ? "border-blue-100 bg-blue-50"
          : isFailed
          ? "border-red-200 bg-red-50"
          : "border-amber-200 bg-amber-50"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {isSuccess ? (
            <span className="text-sm font-semibold text-blue-800">✓ Modifier 동기화 완료</span>
          ) : isFailed ? (
            <span className="text-sm font-semibold text-red-700">✗ Modifier 동기화 실패</span>
          ) : (
            <span className="text-sm font-semibold text-amber-800">⚠ Modifier 미동기화</span>
          )}
          {syncedAtLabel && (
            <span className="text-xs text-gray-500">({syncedAtLabel})</span>
          )}
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          <span className={loading ? "animate-spin inline-block" : ""}>🔄</span>
          {loading ? "동기화 중..." : "Loyverse 새로고침"}
        </button>
      </div>

      {/* Metadata pills */}
      {isSuccess && syncMeta && (
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700">
            그룹 <strong>{syncMeta.groupCount}개</strong>
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700">
            옵션 <strong>{syncMeta.optionCount}개</strong>
          </span>
        </div>
      )}

      {/* Error / info message */}
      {syncMeta && syncMeta.status !== "success" && (
        <p className={`text-xs ${isFailed ? "text-red-700" : "text-amber-700"}`}>
          {errorLabel(syncMeta)}
        </p>
      )}

      {/* Manual fallback toggle */}
      {(isNeverOrEmpty || isFailed) && (
        <div className="border-t border-gray-200 pt-2">
          <button
            type="button"
            onClick={onToggleManualFallback}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            {showManualFallback
              ? "▲ 수동 입력 숨기기"
              : "▼ 수동 modifier ID 입력 (비상 fallback)"}
          </button>
          {showManualFallback && (
            <p className="mt-1 text-xs text-gray-400">
              아래 테이블의 &ldquo;Loyverse Modifier&rdquo; 열에서 modifier option ID를 직접 입력할 수
              있습니다. Loyverse 동기화가 성공하면 이 모드를 닫고 드롭다운에서 선택하세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
