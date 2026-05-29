"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type MatchAction = "skip" | "match" | "create";

type PreviewItem = {
  loyverseItemId: string;
  loyverseItemName: string;
  loyverseSku: string | null;
  status: "matched" | "unmatched";
  matchedProduct: { id: string; name: string; sku: string | null; isActive: boolean } | null;
  candidateProducts: Array<{ id: string; name: string; sku: string | null; isActive: boolean }>;
};

type CategoryPreviewStatus =
  | "linked_match"
  | "linked_changed"
  | "name_match"
  | "new"
  | "local_only";

type CategoryPreviewItem = {
  loyverseId: string | null;
  loyverseName: string | null;
  localId: string | null;
  localName: string | null;
  status: CategoryPreviewStatus;
};

type ModifierOptionPreviewStatus = "unchanged" | "changed" | "new" | "removed";
type ModifierGroupPreviewStatus = "unchanged" | "changed" | "new" | "removed";

type ModifierOptionPreview = {
  loyverseId: string | null;
  localId: string | null;
  name: string;
  newName: string | null;
  priceDelta: number;
  newPriceDelta: number | null;
  status: ModifierOptionPreviewStatus;
};

type ModifierGroupPreview = {
  loyverseId: string | null;
  localId: string | null;
  name: string;
  newName: string | null;
  status: ModifierGroupPreviewStatus;
  options: ModifierOptionPreview[];
};

type ProductModifierPreview = {
  productId: string;
  productName: string;
  groups: ModifierGroupPreview[];
};

type PreviewResponse = {
  items: PreviewItem[];
  matchedCount: number;
  unmatchedCount: number;
  total: number;
  categories: CategoryPreviewItem[];
  modifiers: ProductModifierPreview[];
};

type SyncLogRow = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  categoriesAdded: number;
  categoriesUpdated: number;
  productsAdded: number;
  productsUpdated: number;
  modifiersAdded: number;
  modifiersUpdated: number;
  errorMessage: string | null;
  userName: string | null;
};

type Decision = {
  action: MatchAction;
  localProductId?: string;
};

function statusClass(status: string) {
  if (status === "SUCCESS") return "bg-green-100 text-green-700";
  if (status === "PARTIAL") return "bg-amber-100 text-amber-700";
  if (status === "FAILED") return "bg-red-100 text-red-700";
  return "bg-blue-100 text-blue-700";
}

function categoryStatusBadge(status: CategoryPreviewStatus) {
  switch (status) {
    case "linked_match":
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">연결됨 (변경 없음)</span>;
    case "linked_changed":
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">이름 변경 예정</span>;
    case "name_match":
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">이름 매칭 → 링크</span>;
    case "new":
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">신규 생성</span>;
    case "local_only":
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">삭제됨 → 비활성화</span>;
  }
}

function modifierGroupStatusBadge(status: ModifierGroupPreviewStatus) {
  switch (status) {
    case "unchanged":
      return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">변경 없음</span>;
    case "changed":
      return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">변경 예정</span>;
    case "new":
      return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">신규</span>;
    case "removed":
      return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">비활성화</span>;
  }
}

function modifierOptionStatusBadge(status: ModifierOptionPreviewStatus) {
  switch (status) {
    case "unchanged":
      return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-50 text-green-600">변경 없음</span>;
    case "changed":
      return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-50 text-yellow-600">변경</span>;
    case "new":
      return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600">신규</span>;
    case "removed":
      return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600">비활성화</span>;
  }
}

export default function LoyverseSyncManager({ initialLogs }: { initialLogs: SyncLogRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  const unmatchedItems = useMemo(
    () => (preview?.items ?? []).filter((item) => item.status === "unmatched"),
    [preview]
  );

  async function loadPreview() {
    setLoadingPreview(true);
    setMessage(null);
    try {
      const res = await fetch("/api/loyverse-sync", { cache: "no-store" });
      const data = (await res.json()) as PreviewResponse & { message?: string };
      if (!res.ok) {
        setMessage({ type: "error", text: data.message ?? "Failed to load Loyverse items" });
        setPreview(null);
        return;
      }
      setPreview(data);
      const initialDecisions: Record<string, Decision> = {};
      data.items
        .filter((item) => item.status === "unmatched")
        .forEach((item) => {
          if (item.candidateProducts.length > 0) {
            initialDecisions[item.loyverseItemId] = {
              action: "match",
              localProductId: item.candidateProducts[0].id,
            };
          } else {
            initialDecisions[item.loyverseItemId] = { action: "create" };
          }
        });
      setDecisions(initialDecisions);
    } catch {
      setMessage({ type: "error", text: "Failed to connect to server" });
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  }

  useEffect(() => {
    void loadPreview();
  }, []);

  function updateAction(itemId: string, action: MatchAction) {
    setDecisions((prev) => ({
      ...prev,
      [itemId]: {
        action,
        localProductId: action === "match" ? prev[itemId]?.localProductId : undefined,
      },
    }));
  }

  function updateMatchedProduct(itemId: string, localProductId: string) {
    setDecisions((prev) => ({
      ...prev,
      [itemId]: {
        action: "match",
        localProductId,
      },
    }));
  }

  function handleSync() {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/loyverse-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decisions }),
        });
        const data = (await res.json()) as {
          message?: string;
          result?: { warnings?: string[] };
        };
        if (!res.ok) {
          setMessage({ type: "error", text: data.message ?? "Sync failed" });
          return;
        }

        const warningText = data.result?.warnings?.length
          ? ` (${data.result.warnings.length} warning(s))`
          : "";
        setMessage({ type: "success", text: `Sync completed${warningText}` });

        await loadPreview();
        router.refresh();
      } catch {
        setMessage({ type: "error", text: "Failed to connect to server" });
      }
    });
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm font-medium border ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Matching Preview</h2>
          <button
            type="button"
            onClick={() => void loadPreview()}
            disabled={loadingPreview || isPending}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {loadingPreview ? (
          <p className="text-sm text-gray-500">Loading Loyverse items...</p>
        ) : !preview ? (
          <p className="text-sm text-gray-500">No preview available.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-gray-200 p-3 text-center">
                <p className="text-xs text-gray-500">Total Items</p>
                <p className="text-xl font-bold text-gray-800">{preview.total}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 text-center">
                <p className="text-xs text-gray-500">Already Matched</p>
                <p className="text-xl font-bold text-green-700">{preview.matchedCount}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 text-center">
                <p className="text-xs text-gray-500">Need Decision</p>
                <p className="text-xl font-bold text-amber-700">{preview.unmatchedCount}</p>
              </div>
            </div>

            {unmatchedItems.length === 0 ? (
              <p className="text-sm text-gray-600">All Loyverse items are already matched.</p>
            ) : (
              <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-600 font-medium">Loyverse Item</th>
                      <th className="text-left px-3 py-2 text-gray-600 font-medium">SKU</th>
                      <th className="text-left px-3 py-2 text-gray-600 font-medium">Action</th>
                      <th className="text-left px-3 py-2 text-gray-600 font-medium">Match Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unmatchedItems.map((item) => {
                      const decision = decisions[item.loyverseItemId] ?? { action: "create" as const };
                      return (
                        <tr key={item.loyverseItemId} className="border-b border-gray-100">
                          <td className="px-3 py-2">
                            <p className="font-medium text-gray-800">{item.loyverseItemName}</p>
                            <p className="text-xs text-gray-400">{item.loyverseItemId}</p>
                          </td>
                          <td className="px-3 py-2 text-gray-600">{item.loyverseSku ?? "-"}</td>
                          <td className="px-3 py-2">
                            <select
                              value={decision.action}
                              onChange={(e) => updateAction(item.loyverseItemId, e.target.value as MatchAction)}
                              className="px-2 py-1 border border-gray-300 rounded-md bg-white"
                            >
                              <option value="match">Match existing</option>
                              <option value="create">Create new</option>
                              <option value="skip">Skip</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={decision.localProductId ?? ""}
                              onChange={(e) => updateMatchedProduct(item.loyverseItemId, e.target.value)}
                              disabled={decision.action !== "match"}
                              className="w-full px-2 py-1 border border-gray-300 rounded-md bg-white disabled:opacity-50"
                            >
                              <option value="">Select product...</option>
                              {item.candidateProducts.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  {candidate.name}
                                  {candidate.sku ? ` (${candidate.sku})` : ""}
                                  {!candidate.isActive ? " [inactive]" : ""}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSync}
                disabled={isPending || loadingPreview}
                className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
              >
                {isPending ? "Syncing..." : "Run Loyverse Sync"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Categories Preview ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h2 className="text-base font-semibold text-gray-800">Categories Preview</h2>
        {loadingPreview ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : !preview || preview.categories.length === 0 ? (
          <p className="text-sm text-gray-500">No category changes detected.</p>
        ) : (
          <div className="overflow-x-auto border border-gray-100 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Loyverse 카테고리</th>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">로컬 카테고리</th>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">싱크 후 상태</th>
                </tr>
              </thead>
              <tbody>
                {preview.categories.map((cat, idx) => (
                  <tr key={cat.loyverseId ?? cat.localId ?? idx} className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-800">{cat.loyverseName ?? <span className="text-gray-400 italic">삭제됨</span>}</td>
                    <td className="px-3 py-2">
                      {cat.status === "linked_changed" ? (
                        <span>
                          <span className="line-through text-gray-400">{cat.localName}</span>
                          {" → "}
                          <span className="text-gray-800 font-medium">{cat.loyverseName}</span>
                        </span>
                      ) : (
                        <span className="text-gray-700">{cat.localName ?? <span className="text-gray-400 italic">없음 (신규)</span>}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{categoryStatusBadge(cat.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modifiers Preview ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h2 className="text-base font-semibold text-gray-800">Modifiers Preview</h2>
        {loadingPreview ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : !preview || preview.modifiers.length === 0 ? (
          <p className="text-sm text-gray-500">No modifier changes for linked products.</p>
        ) : (
          <div className="space-y-4">
            {preview.modifiers.map((prod) => {
              const hasChanges = prod.groups.some((g) => g.status !== "unchanged");
              return (
                <div key={prod.productId} className="border border-gray-100 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 flex items-center gap-2 border-b border-gray-100">
                    <span className="font-medium text-gray-800 text-sm">{prod.productName}</span>
                    {!hasChanges && (
                      <span className="px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700">변경 없음</span>
                    )}
                  </div>
                  <div className="divide-y divide-gray-50">
                    {prod.groups.map((group, gi) => (
                      <div key={group.loyverseId ?? group.localId ?? gi} className="px-3 py-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-700 text-sm">
                            {group.status === "removed"
                              ? group.name
                              : group.newName
                              ? (
                                <span>
                                  <span className="line-through text-gray-400">{group.name}</span>
                                  {" → "}
                                  <span>{group.newName}</span>
                                </span>
                              )
                              : group.name}
                          </span>
                          {modifierGroupStatusBadge(group.status)}
                        </div>
                        {group.options.length > 0 && (
                          <div className="ml-4 space-y-1">
                            {group.options.map((opt, oi) => (
                              <div key={opt.loyverseId ?? opt.localId ?? oi} className="flex items-center gap-2 text-xs text-gray-600">
                                <span>
                                  {opt.newName ? (
                                    <span>
                                      <span className="line-through text-gray-400">{opt.name}</span>
                                      {" → "}
                                      <span>{opt.newName}</span>
                                    </span>
                                  ) : (
                                    opt.name
                                  )}
                                </span>
                                <span className="text-gray-400">
                                  {opt.newPriceDelta !== null ? (
                                    <span>
                                      <span className="line-through">{opt.priceDelta >= 0 ? `+$${opt.priceDelta.toFixed(2)}` : `-$${Math.abs(opt.priceDelta).toFixed(2)}`}</span>
                                      {" → "}
                                      {opt.newPriceDelta >= 0 ? `+$${opt.newPriceDelta.toFixed(2)}` : `-$${Math.abs(opt.newPriceDelta).toFixed(2)}`}
                                    </span>
                                  ) : (
                                    opt.priceDelta >= 0 ? `+$${opt.priceDelta.toFixed(2)}` : `-$${Math.abs(opt.priceDelta).toFixed(2)}`
                                  )}
                                </span>
                                {modifierOptionStatusBadge(opt.status)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Sync Logs</h2>
        {initialLogs.length === 0 ? (
          <p className="text-sm text-gray-500">No sync logs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Started</th>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Status</th>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Products</th>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Categories</th>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Modifiers</th>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">By</th>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {initialLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-700">
                      {new Date(log.startedAt).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusClass(log.status)}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      +{log.productsAdded} / ~{log.productsUpdated}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      +{log.categoriesAdded} / ~{log.categoriesUpdated}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      +{log.modifiersAdded} / ~{log.modifiersUpdated}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{log.userName ?? "-"}</td>
                    <td className="px-3 py-2 text-red-600 text-xs">{log.errorMessage ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

type MatchAction = "skip" | "match" | "create";

type PreviewItem = {
  loyverseItemId: string;
  loyverseItemName: string;
  loyverseSku: string | null;
  status: "matched" | "unmatched";
  matchedProduct: { id: string; name: string; sku: string | null; isActive: boolean } | null;
  candidateProducts: Array<{ id: string; name: string; sku: string | null; isActive: boolean }>;
};

type PreviewResponse = {
  items: PreviewItem[];
  matchedCount: number;
  unmatchedCount: number;
  total: number;
};

type SyncLogRow = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  categoriesAdded: number;
  categoriesUpdated: number;
  productsAdded: number;
  productsUpdated: number;
  modifiersAdded: number;
  modifiersUpdated: number;
  errorMessage: string | null;
  userName: string | null;
};

type Decision = {
  action: MatchAction;
  localProductId?: string;
};

function statusClass(status: string) {
  if (status === "SUCCESS") return "bg-green-100 text-green-700";
  if (status === "PARTIAL") return "bg-amber-100 text-amber-700";
  if (status === "FAILED") return "bg-red-100 text-red-700";
  return "bg-blue-100 text-blue-700";
}

export default function LoyverseSyncManager({ initialLogs }: { initialLogs: SyncLogRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  const unmatchedItems = useMemo(
    () => (preview?.items ?? []).filter((item) => item.status === "unmatched"),
    [preview]
  );

  async function loadPreview() {
    setLoadingPreview(true);
    setMessage(null);
    try {
      const res = await fetch("/api/loyverse-sync", { cache: "no-store" });
      const data = (await res.json()) as PreviewResponse & { message?: string };
      if (!res.ok) {
        setMessage({ type: "error", text: data.message ?? "Failed to load Loyverse items" });
        setPreview(null);
        return;
      }
      setPreview(data);
      const initialDecisions: Record<string, Decision> = {};
      data.items
        .filter((item) => item.status === "unmatched")
        .forEach((item) => {
          if (item.candidateProducts.length > 0) {
            initialDecisions[item.loyverseItemId] = {
              action: "match",
              localProductId: item.candidateProducts[0].id,
            };
          } else {
            initialDecisions[item.loyverseItemId] = { action: "create" };
          }
        });
      setDecisions(initialDecisions);
    } catch {
      setMessage({ type: "error", text: "Failed to connect to server" });
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  }

  useEffect(() => {
    void loadPreview();
  }, []);

  function updateAction(itemId: string, action: MatchAction) {
    setDecisions((prev) => ({
      ...prev,
      [itemId]: {
        action,
        localProductId: action === "match" ? prev[itemId]?.localProductId : undefined,
      },
    }));
  }

  function updateMatchedProduct(itemId: string, localProductId: string) {
    setDecisions((prev) => ({
      ...prev,
      [itemId]: {
        action: "match",
        localProductId,
      },
    }));
  }

  function handleSync() {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/loyverse-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decisions }),
        });
        const data = (await res.json()) as {
          message?: string;
          result?: { warnings?: string[] };
        };
        if (!res.ok) {
          setMessage({ type: "error", text: data.message ?? "Sync failed" });
          return;
        }

        const warningText = data.result?.warnings?.length
          ? ` (${data.result.warnings.length} warning(s))`
          : "";
        setMessage({ type: "success", text: `Sync completed${warningText}` });

        await loadPreview();
        router.refresh();
      } catch {
        setMessage({ type: "error", text: "Failed to connect to server" });
      }
    });
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm font-medium border ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Matching Preview</h2>
          <button
            type="button"
            onClick={() => void loadPreview()}
            disabled={loadingPreview || isPending}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {loadingPreview ? (
          <p className="text-sm text-gray-500">Loading Loyverse items...</p>
        ) : !preview ? (
          <p className="text-sm text-gray-500">No preview available.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-gray-200 p-3 text-center">
                <p className="text-xs text-gray-500">Total Items</p>
                <p className="text-xl font-bold text-gray-800">{preview.total}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 text-center">
                <p className="text-xs text-gray-500">Already Matched</p>
                <p className="text-xl font-bold text-green-700">{preview.matchedCount}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 text-center">
                <p className="text-xs text-gray-500">Need Decision</p>
                <p className="text-xl font-bold text-amber-700">{preview.unmatchedCount}</p>
              </div>
            </div>

            {unmatchedItems.length === 0 ? (
              <p className="text-sm text-gray-600">All Loyverse items are already matched.</p>
            ) : (
              <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-600 font-medium">Loyverse Item</th>
                      <th className="text-left px-3 py-2 text-gray-600 font-medium">SKU</th>
                      <th className="text-left px-3 py-2 text-gray-600 font-medium">Action</th>
                      <th className="text-left px-3 py-2 text-gray-600 font-medium">Match Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unmatchedItems.map((item) => {
                      const decision = decisions[item.loyverseItemId] ?? { action: "create" as const };
                      return (
                        <tr key={item.loyverseItemId} className="border-b border-gray-100">
                          <td className="px-3 py-2">
                            <p className="font-medium text-gray-800">{item.loyverseItemName}</p>
                            <p className="text-xs text-gray-400">{item.loyverseItemId}</p>
                          </td>
                          <td className="px-3 py-2 text-gray-600">{item.loyverseSku ?? "-"}</td>
                          <td className="px-3 py-2">
                            <select
                              value={decision.action}
                              onChange={(e) => updateAction(item.loyverseItemId, e.target.value as MatchAction)}
                              className="px-2 py-1 border border-gray-300 rounded-md bg-white"
                            >
                              <option value="match">Match existing</option>
                              <option value="create">Create new</option>
                              <option value="skip">Skip</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={decision.localProductId ?? ""}
                              onChange={(e) => updateMatchedProduct(item.loyverseItemId, e.target.value)}
                              disabled={decision.action !== "match"}
                              className="w-full px-2 py-1 border border-gray-300 rounded-md bg-white disabled:opacity-50"
                            >
                              <option value="">Select product...</option>
                              {item.candidateProducts.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  {candidate.name}
                                  {candidate.sku ? ` (${candidate.sku})` : ""}
                                  {!candidate.isActive ? " [inactive]" : ""}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSync}
                disabled={isPending || loadingPreview}
                className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
              >
                {isPending ? "Syncing..." : "Run Loyverse Sync"}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Sync Logs</h2>
        {initialLogs.length === 0 ? (
          <p className="text-sm text-gray-500">No sync logs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Started</th>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Status</th>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Products</th>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Categories</th>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Modifiers</th>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">By</th>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {initialLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-700">
                      {new Date(log.startedAt).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusClass(log.status)}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      +{log.productsAdded} / ~{log.productsUpdated}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      +{log.categoriesAdded} / ~{log.categoriesUpdated}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      +{log.modifiersAdded} / ~{log.modifiersUpdated}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{log.userName ?? "-"}</td>
                    <td className="px-3 py-2 text-red-600 text-xs">{log.errorMessage ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
