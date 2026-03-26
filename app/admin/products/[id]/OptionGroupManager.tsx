"use client";

import { useState } from "react";

type ProductOption = {
  id: string;
  name: string;
  priceDelta: number;
  isActive: boolean;
  sortOrder: number;
  sku: string | null;
  tracksInventory: boolean;
};

type ProductOptionGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  sortOrder: number;
  options: ProductOption[];
};

type Props = {
  productId: string;
  initialGroups: ProductOptionGroup[];
};

// ── Inline form helpers ───────────────────────────────────────────────────────

type GroupFormState = {
  name: string;
  minSelect: string;
  maxSelect: string;
  isRequired: boolean;
  sortOrder: string;
};

type OptionFormState = {
  name: string;
  priceDelta: string;
  isActive: boolean;
  sortOrder: string;
  sku: string;
  tracksInventory: boolean;
};

function emptyGroupForm(): GroupFormState {
  return { name: "", minSelect: "0", maxSelect: "1", isRequired: false, sortOrder: "0" };
}

function emptyOptionForm(): OptionFormState {
  return { name: "", priceDelta: "0", isActive: true, sortOrder: "0", sku: "", tracksInventory: false };
}

function groupToForm(g: ProductOptionGroup): GroupFormState {
  return {
    name: g.name,
    minSelect: String(g.minSelect),
    maxSelect: String(g.maxSelect),
    isRequired: g.isRequired,
    sortOrder: String(g.sortOrder),
  };
}

function optionToForm(o: ProductOption): OptionFormState {
  return {
    name: o.name,
    priceDelta: String(o.priceDelta),
    isActive: o.isActive,
    sortOrder: String(o.sortOrder),
    sku: o.sku ?? "",
    tracksInventory: o.tracksInventory,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function inputClass(hasError = false) {
  return `w-full px-3 py-1.5 border rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
    hasError ? "border-red-300 bg-red-50" : "border-gray-300"
  }`;
}

function GroupForm({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
  error,
  saveLabel,
}: {
  form: GroupFormState;
  onChange: (f: GroupFormState) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
  saveLabel: string;
}) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
      {error && <p className="text-xs text-red-600">❌ {error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">그룹명 *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="예: 베이글 선택"
            className={inputClass(!form.name)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">정렬 순서</label>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => onChange({ ...form, sortOrder: e.target.value })}
            className={inputClass()}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">최소 선택</label>
          <input
            type="number"
            min="0"
            value={form.minSelect}
            onChange={(e) => onChange({ ...form, minSelect: e.target.value })}
            className={inputClass()}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">최대 선택</label>
          <input
            type="number"
            min="1"
            value={form.maxSelect}
            onChange={(e) => onChange({ ...form, maxSelect: e.target.value })}
            className={inputClass()}
            onFocus={(e) => e.target.select()}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.isRequired}
          onChange={(e) => onChange({ ...form, isRequired: e.target.checked })}
          className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
        />
        필수 선택 그룹
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !form.name.trim()}
          className="px-4 py-1.5 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          {saving ? "저장 중..." : saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          취소
        </button>
      </div>
    </div>
  );
}

function OptionForm({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
  error,
  saveLabel,
}: {
  form: OptionFormState;
  onChange: (f: OptionFormState) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
  saveLabel: string;
}) {
  return (
    <div className="p-3 bg-white rounded-lg border border-gray-200 space-y-3">
      {error && <p className="text-xs text-red-600">❌ {error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">옵션명 *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="예: 플레인 베이글"
            className={inputClass(!form.name)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">추가금액 ($)</label>
          <input
            type="number"
            step="0.01"
            value={form.priceDelta}
            onChange={(e) => onChange({ ...form, priceDelta: e.target.value })}
            className={inputClass()}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">정렬 순서</label>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => onChange({ ...form, sortOrder: e.target.value })}
            className={inputClass()}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">SKU</label>
          <input
            type="text"
            value={form.sku}
            onChange={(e) => onChange({ ...form, sku: e.target.value })}
            placeholder="선택"
            className={inputClass()}
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => onChange({ ...form, isActive: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
          />
          활성
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.tracksInventory}
            onChange={(e) => onChange({ ...form, tracksInventory: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
          />
          재고 추적
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !form.name.trim()}
          className="px-3 py-1.5 bg-amber-500 text-white rounded-md text-xs font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          {saving ? "저장 중..." : saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 bg-white text-gray-700 border border-gray-300 rounded-md text-xs font-medium hover:bg-gray-50 transition-colors"
        >
          취소
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OptionGroupManager({ productId, initialGroups }: Props) {
  const [groups, setGroups] = useState<ProductOptionGroup[]>(initialGroups);

  // Group-level UI state
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupForm, setNewGroupForm] = useState<GroupFormState>(emptyGroupForm());
  const [newGroupSaving, setNewGroupSaving] = useState(false);
  const [newGroupError, setNewGroupError] = useState("");

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupForm, setEditGroupForm] = useState<GroupFormState>(emptyGroupForm());
  const [editGroupSaving, setEditGroupSaving] = useState(false);
  const [editGroupError, setEditGroupError] = useState("");

  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);

  // Option-level UI state
  const [addingOptionGroupId, setAddingOptionGroupId] = useState<string | null>(null);
  const [newOptionForm, setNewOptionForm] = useState<OptionFormState>(emptyOptionForm());
  const [newOptionSaving, setNewOptionSaving] = useState(false);
  const [newOptionError, setNewOptionError] = useState("");

  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editOptionGroupId, setEditOptionGroupId] = useState<string | null>(null);
  const [editOptionForm, setEditOptionForm] = useState<OptionFormState>(emptyOptionForm());
  const [editOptionSaving, setEditOptionSaving] = useState(false);
  const [editOptionError, setEditOptionError] = useState("");

  const [deletingOptionId, setDeletingOptionId] = useState<string | null>(null);

  // ── Group actions ────────────────────────────────────────────────────────────

  const handleAddGroup = async () => {
    setNewGroupSaving(true);
    setNewGroupError("");
    try {
      const res = await fetch(`/api/admin/products/${productId}/option-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newGroupForm.name,
          minSelect: parseInt(newGroupForm.minSelect, 10) || 0,
          maxSelect: parseInt(newGroupForm.maxSelect, 10) || 1,
          isRequired: newGroupForm.isRequired,
          sortOrder: parseInt(newGroupForm.sortOrder, 10) || 0,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "생성에 실패했습니다");
      }
      const { group } = await res.json();
      setGroups((prev) => [...prev, group]);
      setAddingGroup(false);
      setNewGroupForm(emptyGroupForm());
    } catch (e) {
      setNewGroupError(e instanceof Error ? e.message : "생성에 실패했습니다");
    } finally {
      setNewGroupSaving(false);
    }
  };

  const handleEditGroupStart = (group: ProductOptionGroup) => {
    setEditingGroupId(group.id);
    setEditGroupForm(groupToForm(group));
    setEditGroupError("");
  };

  const handleEditGroupSave = async () => {
    if (!editingGroupId) return;
    setEditGroupSaving(true);
    setEditGroupError("");
    try {
      const res = await fetch(
        `/api/admin/products/${productId}/option-groups/${editingGroupId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editGroupForm.name,
            minSelect: parseInt(editGroupForm.minSelect, 10) || 0,
            maxSelect: parseInt(editGroupForm.maxSelect, 10) || 1,
            isRequired: editGroupForm.isRequired,
            sortOrder: parseInt(editGroupForm.sortOrder, 10) || 0,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "수정에 실패했습니다");
      }
      const { group: updated } = await res.json();
      setGroups((prev) =>
        prev.map((g) => (g.id === editingGroupId ? updated : g))
      );
      setEditingGroupId(null);
    } catch (e) {
      setEditGroupError(e instanceof Error ? e.message : "수정에 실패했습니다");
    } finally {
      setEditGroupSaving(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    const confirmed = window.confirm(
      `"${groupName}" 옵션 그룹을 삭제하시겠습니까?\n\n그룹 내 모든 옵션도 함께 삭제됩니다.`
    );
    if (!confirmed) return;

    setDeletingGroupId(groupId);
    try {
      const res = await fetch(
        `/api/admin/products/${productId}/option-groups/${groupId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "삭제에 실패했습니다");
      }
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제에 실패했습니다");
    } finally {
      setDeletingGroupId(null);
    }
  };

  // ── Option actions ───────────────────────────────────────────────────────────

  const handleAddOptionStart = (groupId: string) => {
    setAddingOptionGroupId(groupId);
    setNewOptionForm(emptyOptionForm());
    setNewOptionError("");
  };

  const handleAddOption = async () => {
    if (!addingOptionGroupId) return;
    setNewOptionSaving(true);
    setNewOptionError("");
    try {
      const res = await fetch(
        `/api/admin/products/${productId}/option-groups/${addingOptionGroupId}/options`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newOptionForm.name,
            priceDelta: parseFloat(newOptionForm.priceDelta) || 0,
            isActive: newOptionForm.isActive,
            sortOrder: parseInt(newOptionForm.sortOrder, 10) || 0,
            sku: newOptionForm.sku || null,
            tracksInventory: newOptionForm.tracksInventory,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "생성에 실패했습니다");
      }
      const { option } = await res.json();
      setGroups((prev) =>
        prev.map((g) =>
          g.id === addingOptionGroupId
            ? { ...g, options: [...g.options, option] }
            : g
        )
      );
      setAddingOptionGroupId(null);
    } catch (e) {
      setNewOptionError(e instanceof Error ? e.message : "생성에 실패했습니다");
    } finally {
      setNewOptionSaving(false);
    }
  };

  const handleEditOptionStart = (groupId: string, option: ProductOption) => {
    setEditingOptionId(option.id);
    setEditOptionGroupId(groupId);
    setEditOptionForm(optionToForm(option));
    setEditOptionError("");
  };

  const handleEditOptionSave = async () => {
    if (!editingOptionId || !editOptionGroupId) return;
    setEditOptionSaving(true);
    setEditOptionError("");
    try {
      const res = await fetch(
        `/api/admin/products/${productId}/option-groups/${editOptionGroupId}/options/${editingOptionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editOptionForm.name,
            priceDelta: parseFloat(editOptionForm.priceDelta) || 0,
            isActive: editOptionForm.isActive,
            sortOrder: parseInt(editOptionForm.sortOrder, 10) || 0,
            sku: editOptionForm.sku || null,
            tracksInventory: editOptionForm.tracksInventory,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "수정에 실패했습니다");
      }
      const { option: updated } = await res.json();
      setGroups((prev) =>
        prev.map((g) =>
          g.id === editOptionGroupId
            ? { ...g, options: g.options.map((o) => (o.id === editingOptionId ? updated : o)) }
            : g
        )
      );
      setEditingOptionId(null);
      setEditOptionGroupId(null);
    } catch (e) {
      setEditOptionError(e instanceof Error ? e.message : "수정에 실패했습니다");
    } finally {
      setEditOptionSaving(false);
    }
  };

  const handleDeleteOption = async (groupId: string, optionId: string, optionName: string) => {
    const confirmed = window.confirm(`"${optionName}" 옵션을 삭제하시겠습니까?`);
    if (!confirmed) return;

    setDeletingOptionId(optionId);
    try {
      const res = await fetch(
        `/api/admin/products/${productId}/option-groups/${groupId}/options/${optionId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "삭제에 실패했습니다");
      }
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId ? { ...g, options: g.options.filter((o) => o.id !== optionId) } : g
        )
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제에 실패했습니다");
    } finally {
      setDeletingOptionId(null);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <h2 className="text-base font-semibold text-gray-900">옵션 그룹 관리</h2>
        {!addingGroup && (
          <button
            type="button"
            onClick={() => {
              setAddingGroup(true);
              setNewGroupForm(emptyGroupForm());
              setNewGroupError("");
            }}
            className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-xs font-medium hover:bg-amber-100 transition-colors"
          >
            + 그룹 추가
          </button>
        )}
      </div>

      {/* Add new group form */}
      {addingGroup && (
        <GroupForm
          form={newGroupForm}
          onChange={setNewGroupForm}
          onSave={handleAddGroup}
          onCancel={() => setAddingGroup(false)}
          saving={newGroupSaving}
          error={newGroupError}
          saveLabel="그룹 추가"
        />
      )}

      {groups.length === 0 && !addingGroup && (
        <p className="text-sm text-gray-400 text-center py-4">
          등록된 옵션 그룹이 없습니다. 그룹을 추가해보세요.
        </p>
      )}

      {/* Option groups list */}
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.id} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Group header */}
            {editingGroupId === group.id ? (
              <div className="p-4 bg-amber-50">
                <GroupForm
                  form={editGroupForm}
                  onChange={setEditGroupForm}
                  onSave={handleEditGroupSave}
                  onCancel={() => setEditingGroupId(null)}
                  saving={editGroupSaving}
                  error={editGroupError}
                  saveLabel="저장"
                />
              </div>
            ) : (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-medium text-gray-900 text-sm">{group.name}</span>
                  <span className="text-xs text-gray-500">
                    선택 {group.minSelect}~{group.maxSelect}개
                  </span>
                  {group.isRequired && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                      필수
                    </span>
                  )}
                  <span className="text-xs text-gray-400">정렬: {group.sortOrder}</span>
                  <span className="text-xs text-gray-400">{group.options.length}개 옵션</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEditGroupStart(group)}
                    className="px-2.5 py-1 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteGroup(group.id, group.name)}
                    disabled={deletingGroupId === group.id}
                    className="px-2.5 py-1 text-xs text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {deletingGroupId === group.id ? "삭제 중..." : "삭제"}
                  </button>
                </div>
              </div>
            )}

            {/* Options list */}
            <div className="divide-y divide-gray-100">
              {group.options.map((option) => (
                <div key={option.id}>
                  {editingOptionId === option.id ? (
                    <div className="p-3">
                      <OptionForm
                        form={editOptionForm}
                        onChange={setEditOptionForm}
                        onSave={handleEditOptionSave}
                        onCancel={() => {
                          setEditingOptionId(null);
                          setEditOptionGroupId(null);
                        }}
                        saving={editOptionSaving}
                        error={editOptionError}
                        saveLabel="저장"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3 flex-wrap text-sm">
                        <span className="text-gray-800">{option.name}</span>
                        <span className="text-gray-500 tabular-nums">
                          {option.priceDelta === 0
                            ? "무료"
                            : option.priceDelta > 0
                            ? `+$${option.priceDelta.toFixed(2)}`
                            : `-$${Math.abs(option.priceDelta).toFixed(2)}`}
                        </span>
                        {!option.isActive && (
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-400 text-xs rounded-full">
                            비활성
                          </span>
                        )}
                        {option.tracksInventory && (
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">
                            재고추적
                          </span>
                        )}
                        {option.sku && (
                          <span className="text-xs text-gray-400">SKU: {option.sku}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditOptionStart(group.id, option)}
                          className="px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteOption(group.id, option.id, option.name)}
                          disabled={deletingOptionId === option.id}
                          className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {deletingOptionId === option.id ? "..." : "삭제"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add option row */}
              {addingOptionGroupId === group.id ? (
                <div className="p-3">
                  <OptionForm
                    form={newOptionForm}
                    onChange={setNewOptionForm}
                    onSave={handleAddOption}
                    onCancel={() => setAddingOptionGroupId(null)}
                    saving={newOptionSaving}
                    error={newOptionError}
                    saveLabel="옵션 추가"
                  />
                </div>
              ) : (
                <div className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => handleAddOptionStart(group.id)}
                    className="text-xs text-amber-600 hover:text-amber-800 transition-colors font-medium"
                  >
                    + 옵션 추가
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
