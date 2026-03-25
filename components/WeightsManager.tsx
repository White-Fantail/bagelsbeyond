"use client";

import { useState } from "react";
import type { PredictionWeight } from "@/types";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";

type Props = {
  initialWeights: PredictionWeight[];
};

type EditState = {
  id: string;
  factorKey: string;
  weightValue: string;
  isActive: boolean;
  description: string;
};

const GROUPS: { key: string; label: string; icon: string; prefix: string[] }[] = [
  { key: "weekday", label: "요일", icon: "📅", prefix: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] },
  { key: "weather", label: "날씨", icon: "🌤️", prefix: ["weather_"] },
  { key: "holiday", label: "공휴일", icon: "🎉", prefix: ["holiday"] },
  { key: "events", label: "이벤트", icon: "🎪", prefix: ["local_event", "school_holiday"] },
  { key: "news", label: "뉴스", icon: "📰", prefix: ["nz_news", "world_news"] },
];

function getGroupIcon(factorKey: string): string {
  return GROUPS.find((g) => g.prefix.some((p) => factorKey === p || factorKey.startsWith(p)))?.icon ?? "•";
}

function getGroup(factorKey: string): string {
  for (const g of GROUPS) {
    if (g.prefix.some((p) => factorKey === p || factorKey.startsWith(p))) {
      return g.key;
    }
  }
  return "other";
}

function formatWeightPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(0)}%`;
}

function WeightBar({ value }: { value: number }) {
  const clamped = Math.max(-1, Math.min(1, value));
  const isPos = clamped >= 0;
  const width = Math.abs(clamped) * 50; // max 50% width in either direction
  return (
    <div className="relative h-2 bg-gray-100 rounded-full w-20">
      <div
        className={`absolute top-0 h-2 rounded-full ${isPos ? "bg-green-400" : "bg-red-400"}`}
        style={{
          left: isPos ? "50%" : `${50 - width}%`,
          width: `${width}%`,
        }}
      />
      <div className="absolute top-0 left-1/2 w-px h-2 bg-gray-300" />
    </div>
  );
}

export default function WeightsManager({ initialWeights }: Props) {
  const [weights, setWeights] = useState<PredictionWeight[]>(initialWeights);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newForm, setNewForm] = useState({
    factorKey: "",
    weightValue: "0",
    isActive: true,
    description: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>("all");

  const startEdit = (w: PredictionWeight) => {
    setEditState({
      id: w.id,
      factorKey: w.factorKey,
      weightValue: String(w.weightValue),
      isActive: w.isActive,
      description: w.description ?? "",
    });
  };

  const cancelEdit = () => setEditState(null);

  const saveEdit = async () => {
    if (!editState) return;
    setIsSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/weights/${editState.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factorKey: editState.factorKey,
          weightValue: parseFloat(editState.weightValue),
          isActive: editState.isActive,
          description: editState.description || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "수정에 실패했습니다");
      }
      const updated: PredictionWeight = await res.json();
      setWeights((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      setEditState(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "수정에 실패했습니다");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/weights/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제에 실패했습니다");
      setWeights((prev) => prev.filter((w) => w.id !== deleteId));
      setDeleteId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제에 실패했습니다");
    } finally {
      setIsDeleting(false);
    }
  };

  const addNew = async () => {
    setIsSaving(true);
    setError("");
    try {
      const res = await fetch("/api/weights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factorKey: newForm.factorKey,
          weightValue: parseFloat(newForm.weightValue),
          isActive: newForm.isActive,
          description: newForm.description || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "저장에 실패했습니다");
      }
      const created: PredictionWeight = await res.json();
      setWeights((prev) => [...prev, created]);
      setNewForm({ factorKey: "", weightValue: "0", isActive: true, description: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredWeights =
    activeGroup === "all"
      ? weights
      : activeGroup === "other"
      ? weights.filter((w) => getGroup(w.factorKey) === "other")
      : weights.filter((w) => getGroup(w.factorKey) === activeGroup);

  const groupCounts: Record<string, number> = { all: weights.length };
  for (const w of weights) {
    const g = getGroup(w.factorKey);
    groupCounts[g] = (groupCounts[g] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">❌ {error}</div>
      )}

      {/* Group Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveGroup("all")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeGroup === "all" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          전체 ({groupCounts.all ?? 0})
        </button>
        {GROUPS.map((g) => (
          <button
            key={g.key}
            onClick={() => setActiveGroup(g.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeGroup === g.key ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {g.icon} {g.label} ({groupCounts[g.key] ?? 0})
          </button>
        ))}
        {(groupCounts["other"] ?? 0) > 0 && (
          <button
            onClick={() => setActiveGroup("other")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeGroup === "other" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            기타 ({groupCounts["other"] ?? 0})
          </button>
        )}
      </div>

      {/* Guide */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
        <strong>💡 가중치 안내:</strong> 가중치는 예측 매출 대비 비율입니다. <code>+0.2</code> = 20% 증가, <code>-0.15</code> = 15% 감소.
        일반적으로 <strong>-1.0 ~ +1.0</strong> 범위 권장.
      </div>

      {/* Weights Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">요인 키</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">설명</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">가중치</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">효과</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">활성</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">액션</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredWeights.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  해당 카테고리의 가중치가 없습니다.
                </td>
              </tr>
            )}
            {filteredWeights.map((w) =>
              editState?.id === w.id ? (
                <tr key={w.id} className="bg-amber-50">
                  <td className="px-4 py-2">
                    <input
                      value={editState.factorKey}
                      onChange={(e) => setEditState({ ...editState, factorKey: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white font-mono"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={editState.description}
                      onChange={(e) => setEditState({ ...editState, description: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                    />
                  </td>
                  <td className="px-4 py-2" colSpan={2}>
                    <input
                      type="number"
                      step="0.01"
                      min="-1"
                      max="2"
                      value={editState.weightValue}
                      onChange={(e) => setEditState({ ...editState, weightValue: e.target.value })}
                      className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white text-center mx-auto block"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={editState.isActive}
                      onChange={(e) => setEditState({ ...editState, isActive: e.target.checked })}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={saveEdit}
                        disabled={isSaving}
                        className="px-2 py-1 bg-amber-500 text-white rounded text-xs hover:bg-amber-600 disabled:opacity-50"
                      >
                        저장
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-2 py-1 bg-white text-gray-700 border border-gray-300 rounded text-xs hover:bg-gray-50"
                      >
                        취소
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={w.id} className={`hover:bg-gray-50 ${!w.isActive ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono text-gray-800">{w.factorKey}</span>
                    <span className="ml-1 text-xs text-gray-400">{getGroupIcon(w.factorKey)}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{w.description ?? "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-bold ${w.weightValue > 0 ? "text-green-600" : w.weightValue < 0 ? "text-red-600" : "text-gray-400"}`}>
                      {formatWeightPercent(w.weightValue)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center">
                      <WeightBar value={w.weightValue} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${w.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${w.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                      {w.isActive ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => startEdit(w)}
                        className="px-2 py-1 bg-white text-gray-700 border border-gray-300 rounded text-xs hover:bg-gray-50"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => setDeleteId(w.id)}
                        className="px-2 py-1 bg-white text-red-600 border border-red-200 rounded text-xs hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {/* Add new weight */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">새 항목 추가</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600">요인 키 *</label>
            <input
              value={newForm.factorKey}
              onChange={(e) => setNewForm({ ...newForm, factorKey: e.target.value })}
              placeholder="factor_key"
              className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600">가중치 *</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.05"
                min="-1"
                max="2"
                value={newForm.weightValue}
                onChange={(e) => setNewForm({ ...newForm, weightValue: e.target.value })}
                className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <span className={`text-sm font-bold ${parseFloat(newForm.weightValue) > 0 ? "text-green-600" : parseFloat(newForm.weightValue) < 0 ? "text-red-600" : "text-gray-400"}`}>
                {formatWeightPercent(parseFloat(newForm.weightValue) || 0)}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-32">
            <label className="text-xs text-gray-600">설명</label>
            <input
              value={newForm.description}
              onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
              placeholder="요인 설명 (선택)"
              className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="flex items-center gap-2 pb-1">
            <input
              type="checkbox"
              id="newIsActive"
              checked={newForm.isActive}
              onChange={(e) => setNewForm({ ...newForm, isActive: e.target.checked })}
            />
            <label htmlFor="newIsActive" className="text-sm text-gray-700">활성</label>
          </div>
          <button
            onClick={addNew}
            disabled={isSaving || !newForm.factorKey}
            className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
          >
            {isSaving ? "저장 중..." : "+ 추가"}
          </button>
        </div>
      </div>

      <ConfirmDeleteDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
