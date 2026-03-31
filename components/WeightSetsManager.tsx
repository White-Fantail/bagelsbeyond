"use client";

import { useState, useCallback } from "react";
import type { WeightSet, WeightSetEntry } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPct(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(0)}%`;
}

function WeightBar({ value }: { value: number }) {
  const clamped = Math.max(-1, Math.min(1, value));
  const isPos = clamped >= 0;
  const width = Math.abs(clamped) * 50;
  return (
    <div className="relative h-2 bg-gray-100 rounded-full w-16 shrink-0">
      <div
        className={`absolute top-0 h-2 rounded-full ${isPos ? "bg-green-400" : "bg-red-400"}`}
        style={{ left: isPos ? "50%" : `${50 - width}%`, width: `${width}%` }}
      />
      <div className="absolute top-0 left-1/2 w-px h-2 bg-gray-300" />
    </div>
  );
}

// ─── Entry diff row ───────────────────────────────────────────────────────────

type EntryMap = Record<string, WeightSetEntry>;

function buildEntryMap(entries: WeightSetEntry[]): EntryMap {
  const m: EntryMap = {};
  for (const e of entries) m[e.factorKey] = e;
  return m;
}

function DiffTable({ leftSet, rightSet }: { leftSet: WeightSet; rightSet: WeightSet }) {
  const leftMap = buildEntryMap(leftSet.entries ?? []);
  const rightMap = buildEntryMap(rightSet.entries ?? []);
  const allKeys = Array.from(new Set([...Object.keys(leftMap), ...Object.keys(rightMap)])).sort();

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
          <tr>
            <th className="px-3 py-2 text-left">Factor Key</th>
            <th className="px-3 py-2 text-center text-blue-600">v{leftSet.version} {leftSet.name}</th>
            <th className="px-3 py-2 text-center text-purple-600">v{rightSet.version} {rightSet.name}</th>
            <th className="px-3 py-2 text-center">Diff</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {allKeys.map((key) => {
            const l = leftMap[key];
            const r = rightMap[key];
            const lv = l?.weightValue ?? null;
            const rv = r?.weightValue ?? null;
            const diff = lv !== null && rv !== null ? rv - lv : null;
            const changed = diff !== null && Math.abs(diff) > 0.0001;
            return (
              <tr key={key} className={changed ? "bg-amber-50" : ""}>
                <td className="px-3 py-2 font-mono text-gray-700">{key}</td>
                <td className="px-3 py-2 text-center">
                  {lv !== null ? (
                    <span className={`font-bold ${lv > 0 ? "text-green-600" : lv < 0 ? "text-red-600" : "text-gray-400"}`}>
                      {formatPct(lv)}
                    </span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2 text-center">
                  {rv !== null ? (
                    <span className={`font-bold ${rv > 0 ? "text-green-600" : rv < 0 ? "text-red-600" : "text-gray-400"}`}>
                      {formatPct(rv)}
                    </span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2 text-center">
                  {diff !== null ? (
                    <span className={`text-xs font-medium ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-gray-400"}`}>
                      {diff > 0 ? "+" : ""}{(diff * 100).toFixed(1)}%
                    </span>
                  ) : <span className="text-gray-300 text-xs">new/removed</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type OptimizeResult = {
  suggestedEntries: { factorKey: string; weightValue: number; isActive: boolean; description?: string }[];
  dataPointCount: number;
  message: string;
};

type Props = {
  initialSets: WeightSet[];
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WeightSetsManager({ initialSets }: Props) {
  const [sets, setSets] = useState<WeightSet[]>(initialSets);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedSet, setExpandedSet] = useState<WeightSet | null>(null);
  const [compareLeft, setCompareLeft] = useState<string>("");
  const [compareRight, setCompareRight] = useState<string>("");
  const [compareData, setCompareData] = useState<{ left: WeightSet; right: WeightSet } | null>(null);
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);
  const [newSetName, setNewSetName] = useState("");
  const [newSetDesc, setNewSetDesc] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isActivating, setIsActivating] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null);
  const [optimizeSetName, setOptimizeSetName] = useState("");
  const [error, setError] = useState("");

  // Load detail for expanded set
  const loadDetail = useCallback(async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedSet(null);
      return;
    }
    setExpandedId(id);
    try {
      const res = await fetch(`/api/weight-sets/${id}`);
      if (!res.ok) throw new Error("Failed to load");
      const data: WeightSet = await res.json();
      setExpandedSet(data);
    } catch {
      setError("Failed to load weight set details");
    }
  }, [expandedId]);

  // Snapshot current weights
  const snapshotCurrent = async () => {
    if (!newSetName.trim()) { setError("Please enter a name for the snapshot"); return; }
    setIsSaving(true);
    setError("");
    try {
      const res = await fetch("/api/weight-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSetName.trim(), description: newSetDesc.trim() || undefined, source: "manual" }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      const created: WeightSet = await res.json();
      setSets((prev) => [created, ...prev]);
      setNewSetName("");
      setNewSetDesc("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  // Activate (rollback) a set
  const activateSet = async (id: string) => {
    setIsActivating(id);
    setError("");
    try {
      const res = await fetch(`/api/weight-sets/${id}/activate`, { method: "POST" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      // Refresh list
      const listRes = await fetch("/api/weight-sets");
      if (listRes.ok) setSets(await listRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activation failed");
    } finally {
      setIsActivating(null);
    }
  };

  // Delete a set
  const deleteSet = async (id: string) => {
    setIsDeleting(id);
    setError("");
    try {
      const res = await fetch(`/api/weight-sets/${id}`, { method: "DELETE" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      setSets((prev) => prev.filter((s) => s.id !== id));
      if (expandedId === id) { setExpandedId(null); setExpandedSet(null); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setIsDeleting(null);
    }
  };

  // Load sets for comparison
  const loadCompare = async () => {
    if (!compareLeft || !compareRight || compareLeft === compareRight) {
      setError("Please select two different versions to compare");
      return;
    }
    setIsLoadingCompare(true);
    setError("");
    try {
      const [lRes, rRes] = await Promise.all([
        fetch(`/api/weight-sets/${compareLeft}`),
        fetch(`/api/weight-sets/${compareRight}`),
      ]);
      if (!lRes.ok || !rRes.ok) throw new Error("Failed to load sets");
      const [left, right] = await Promise.all([lRes.json(), rRes.json()]) as [WeightSet, WeightSet];
      setCompareData({ left, right });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compare failed");
    } finally {
      setIsLoadingCompare(false);
    }
  };

  // Auto-optimize
  const runOptimize = async () => {
    setIsOptimizing(true);
    setError("");
    setOptimizeResult(null);
    try {
      const res = await fetch("/api/weight-sets/optimize", { method: "POST" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      const data: OptimizeResult = await res.json();
      setOptimizeResult(data);
      setOptimizeSetName(`Auto-optimized v${(sets[0]?.version ?? 0) + 1}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Optimization failed");
    } finally {
      setIsOptimizing(false);
    }
  };

  // Save optimized suggestion as new set
  const saveOptimized = async () => {
    if (!optimizeResult) return;
    if (!optimizeSetName.trim()) { setError("Please enter a name"); return; }
    setIsSaving(true);
    setError("");
    try {
      const res = await fetch("/api/weight-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: optimizeSetName.trim(),
          description: optimizeResult.message,
          source: "auto_optimized",
          entries: optimizeResult.suggestedEntries,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      const created: WeightSet = await res.json();
      setSets((prev) => [created, ...prev]);
      setOptimizeResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const sourceLabel = (source: string) =>
    source === "auto_optimized"
      ? <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">🤖 Auto</span>
      : <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">✋ Manual</span>;

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">❌ {error}</div>
      )}

      {/* ── Snapshot current weights ── */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">📸 Snapshot Current Weights as New Version</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1 flex-1 min-w-40">
            <label className="text-xs text-gray-600">Version Name *</label>
            <input
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              placeholder="e.g. Summer baseline"
              className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-40">
            <label className="text-xs text-gray-600">Description</label>
            <input
              value={newSetDesc}
              onChange={(e) => setNewSetDesc(e.target.value)}
              placeholder="Optional note"
              className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <button
            onClick={snapshotCurrent}
            disabled={isSaving || !newSetName.trim()}
            className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Snapshot"}
          </button>
        </div>
      </div>

      {/* ── Auto-optimize panel ── */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">🤖 Auto-Optimize Weights</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Analyses recent prediction accuracy and suggests adjusted weights. You can review and approve before activating.
            </p>
          </div>
          <button
            onClick={runOptimize}
            disabled={isOptimizing}
            className="px-4 py-2 bg-purple-500 text-white rounded-md text-sm font-medium hover:bg-purple-600 disabled:opacity-50 shrink-0"
          >
            {isOptimizing ? "Calculating..." : "Run Optimization"}
          </button>
        </div>

        {optimizeResult && (
          <div className="mt-3 space-y-3">
            <div className="text-xs text-gray-500 bg-purple-50 border border-purple-100 rounded p-2">
              ℹ️ {optimizeResult.message}
            </div>
            <div className="overflow-x-auto rounded border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Factor Key</th>
                    <th className="px-3 py-2 text-center">Suggested Weight</th>
                    <th className="px-3 py-2 text-center">Effect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {optimizeResult.suggestedEntries.map((e) => (
                    <tr key={e.factorKey}>
                      <td className="px-3 py-2 font-mono text-gray-700">{e.factorKey}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`font-bold ${e.weightValue > 0 ? "text-green-600" : e.weightValue < 0 ? "text-red-600" : "text-gray-400"}`}>
                          {formatPct(e.weightValue)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-center"><WeightBar value={e.weightValue} /></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <input
                value={optimizeSetName}
                onChange={(e) => setOptimizeSetName(e.target.value)}
                placeholder="Version name"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 flex-1 min-w-40"
              />
              <button
                onClick={saveOptimized}
                disabled={isSaving}
                className="px-4 py-2 bg-purple-500 text-white rounded-md text-sm font-medium hover:bg-purple-600 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Approve & Save as New Version"}
              </button>
              <button
                onClick={() => setOptimizeResult(null)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Version list ── */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">📋 Version History</h3>
        </div>
        {sets.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">No versions saved yet. Create a snapshot to start tracking.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sets.map((s) => (
              <li key={s.id}>
                <div className="px-4 py-3 flex flex-wrap gap-2 items-center">
                  {/* Version badge */}
                  <span className="text-xs font-bold text-gray-500 w-10 shrink-0">v{s.version}</span>

                  {/* Active indicator */}
                  {s.isActive && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active
                    </span>
                  )}

                  {/* Source */}
                  {sourceLabel(s.source)}

                  {/* Name & description */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800 truncate block">{s.name}</span>
                    {s.description && <span className="text-xs text-gray-400 truncate block">{s.description}</span>}
                  </div>

                  {/* Date */}
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(s.createdAt).toLocaleDateString("en-NZ", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => loadDetail(s.id)}
                      className="px-2 py-1 text-xs bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                    >
                      {expandedId === s.id ? "Hide" : "View"}
                    </button>
                    {!s.isActive && (
                      <>
                        <button
                          onClick={() => activateSet(s.id)}
                          disabled={isActivating === s.id}
                          className="px-2 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
                        >
                          {isActivating === s.id ? "..." : "Activate"}
                        </button>
                        <button
                          onClick={() => deleteSet(s.id)}
                          disabled={isDeleting === s.id}
                          className="px-2 py-1 text-xs bg-white border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
                        >
                          {isDeleting === s.id ? "..." : "Delete"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded entries */}
                {expandedId === s.id && expandedSet?.id === s.id && (
                  <div className="px-4 pb-3">
                    <div className="overflow-x-auto rounded border border-gray-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                          <tr>
                            <th className="px-3 py-2 text-left">Factor Key</th>
                            <th className="px-3 py-2 text-left">Description</th>
                            <th className="px-3 py-2 text-center">Weight</th>
                            <th className="px-3 py-2 text-center">Effect</th>
                            <th className="px-3 py-2 text-center">Active</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(expandedSet.entries ?? []).map((e) => (
                            <tr key={e.id} className={e.isActive ? "" : "opacity-50"}>
                              <td className="px-3 py-2 font-mono text-gray-700">{e.factorKey}</td>
                              <td className="px-3 py-2 text-gray-500 text-xs">{e.description ?? "—"}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`font-bold ${e.weightValue > 0 ? "text-green-600" : e.weightValue < 0 ? "text-red-600" : "text-gray-400"}`}>
                                  {formatPct(e.weightValue)}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex justify-center"><WeightBar value={e.weightValue} /></div>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs ${e.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${e.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                                  {e.isActive ? "On" : "Off"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Version comparison ── */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">🔍 Compare Two Versions</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600">Version A</label>
            <select
              value={compareLeft}
              onChange={(e) => setCompareLeft(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 w-48"
            >
              <option value="">Select version…</option>
              {sets.map((s) => (
                <option key={s.id} value={s.id}>v{s.version} – {s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600">Version B</label>
            <select
              value={compareRight}
              onChange={(e) => setCompareRight(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 w-48"
            >
              <option value="">Select version…</option>
              {sets.map((s) => (
                <option key={s.id} value={s.id}>v{s.version} – {s.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={loadCompare}
            disabled={isLoadingCompare || !compareLeft || !compareRight}
            className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
          >
            {isLoadingCompare ? "Loading..." : "Compare"}
          </button>
          {compareData && (
            <button
              onClick={() => setCompareData(null)}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </div>

        {compareData && (
          <div className="mt-4">
            <DiffTable leftSet={compareData.left} rightSet={compareData.right} />
          </div>
        )}
      </div>
    </div>
  );
}
