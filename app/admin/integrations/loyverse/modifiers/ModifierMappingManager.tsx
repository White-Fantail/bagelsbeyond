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
          return null;
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
