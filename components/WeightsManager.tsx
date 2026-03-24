"use client";

import { useState } from "react";
import type { PredictionWeight } from "@/types";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";

type Props = {
  initialWeights: PredictionWeight[];
};

function formatWeightValue(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}

type EditState = {
  id: string;
  factorKey: string;
  weightValue: string;
  isActive: boolean;
  description: string;
};

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
      setWeights((prev) => [...prev, created].sort((a, b) => a.factorKey.localeCompare(b.factorKey)));
      setNewForm({ factorKey: "", weightValue: "0", isActive: true, description: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          ❌ {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">키</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">가중치</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">활성</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">설명</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">액션</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {weights.map((w) =>
              editState?.id === w.id ? (
                <tr key={w.id} className="bg-amber-50">
                  <td className="px-4 py-2">
                    <input
                      value={editState.factorKey}
                      onChange={(e) => setEditState({ ...editState, factorKey: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.01"
                      value={editState.weightValue}
                      onChange={(e) => setEditState({ ...editState, weightValue: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={editState.isActive}
                      onChange={(e) => setEditState({ ...editState, isActive: e.target.checked })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={editState.description}
                      onChange={(e) => setEditState({ ...editState, description: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
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
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">{w.factorKey}</td>
                   <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                    {formatWeightValue(w.weightValue)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${w.isActive ? "bg-green-500" : "bg-gray-300"}`} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{w.description ?? "-"}</td>
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

      {/* Add new weight form */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">새 항목 추가</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600">키 *</label>
            <input
              value={newForm.factorKey}
              onChange={(e) => setNewForm({ ...newForm, factorKey: e.target.value })}
              placeholder="factor_key"
              className="px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600">가중치 *</label>
            <input
              type="number"
              step="0.01"
              value={newForm.weightValue}
              onChange={(e) => setNewForm({ ...newForm, weightValue: e.target.value })}
              className="w-28 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600">설명</label>
            <input
              value={newForm.description}
              onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
              placeholder="설명 (선택)"
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
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
            {isSaving ? "저장 중..." : "추가"}
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
