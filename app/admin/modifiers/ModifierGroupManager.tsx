"use client";

import { useState } from "react";
import Link from "next/link";

type ProductOption = {
  id: string;
  name: string;
  priceDelta: number;
  isActive: boolean;
  sortOrder: number;
  sku: string | null;
  tracksInventory: boolean;
};

export type EditableModifierGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  sortOrder: number;
  isLoyverseSynced: boolean;
  options: (ProductOption & { isLoyverseSynced: boolean })[];
};

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

function inputCls(hasError = false) {
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
          <label className="block text-xs font-medium text-gray-600 mb-1">Group Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="e.g. Bagel Selection"
            className={inputCls(!form.name)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Sort Order</label>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => onChange({ ...form, sortOrder: e.target.value })}
            className={inputCls()}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Min Select</label>
          <input
            type="number"
            min="0"
            value={form.minSelect}
            onChange={(e) => onChange({ ...form, minSelect: e.target.value })}
            className={inputCls()}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Max Select</label>
          <input
            type="number"
            min="1"
            value={form.maxSelect}
            onChange={(e) => onChange({ ...form, maxSelect: e.target.value })}
            className={inputCls()}
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
        Required Selection Group
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !form.name.trim()}
          className="px-4 py-1.5 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving......" : saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
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
          <label className="block text-xs font-medium text-gray-600 mb-1">Option Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="e.g. Plain Bagel"
            className={inputCls(!form.name)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">AddAmount ($)</label>
          <input
            type="number"
            step="0.01"
            value={form.priceDelta}
            onChange={(e) => onChange({ ...form, priceDelta: e.target.value })}
            className={inputCls()}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Sort Order</label>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => onChange({ ...form, sortOrder: e.target.value })}
            className={inputCls()}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">SKU</label>
          <input
            type="text"
            value={form.sku}
            onChange={(e) => onChange({ ...form, sku: e.target.value })}
            placeholder="Select"
            className={inputCls()}
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
          Active
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.tracksInventory}
            onChange={(e) => onChange({ ...form, tracksInventory: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
          />
          Inventory Tracking
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !form.name.trim()}
          className="px-3 py-1.5 bg-amber-500 text-white rounded-md text-xs font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving......" : saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 bg-white text-gray-700 border border-gray-300 rounded-md text-xs font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ModifierGroupManager({
  initialGroups,
}: {
  initialGroups: EditableModifierGroup[];
}) {
  const [groups, setGroups] = useState<EditableModifierGroup[]>(initialGroups);

  // Group-level state
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupForm, setNewGroupForm] = useState<GroupFormState>(emptyGroupForm());
  const [newGroupSaving, setNewGroupSaving] = useState(false);
  const [newGroupError, setNewGroupError] = useState("");

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupForm, setEditGroupForm] = useState<GroupFormState>(emptyGroupForm());
  const [editGroupSaving, setEditGroupSaving] = useState(false);
  const [editGroupError, setEditGroupError] = useState("");

  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);

  // Option-level state
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

  // ── Group actions ────────────────────────────────────────────────────────
  const handleAddGroup = async () => {
    setNewGroupSaving(true);
    setNewGroupError("");
    try {
      const res = await fetch("/api/admin/modifier-groups", {
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
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message || "Create failed");
      }
      const { group } = (await res.json()) as {
        group: {
          id: string;
          name: string;
          minSelect: number;
          maxSelect: number;
          isRequired: boolean;
          sortOrder: number;
          options: ProductOption[];
        };
      };
      const newGroup: EditableModifierGroup = { ...group, isLoyverseSynced: false, options: group.options.map((o) => ({ ...o, isLoyverseSynced: false })) };
      setGroups((prev) => [...prev, newGroup]);
      setAddingGroup(false);
      setNewGroupForm(emptyGroupForm());
    } catch (e) {
      setNewGroupError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setNewGroupSaving(false);
    }
  };

  const handleEditGroupSave = async () => {
    if (!editingGroupId) return;
    setEditGroupSaving(true);
    setEditGroupError("");
    try {
      const res = await fetch(`/api/admin/modifier-groups/${editingGroupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editGroupForm.name,
          minSelect: parseInt(editGroupForm.minSelect, 10) || 0,
          maxSelect: parseInt(editGroupForm.maxSelect, 10) || 1,
          isRequired: editGroupForm.isRequired,
          sortOrder: parseInt(editGroupForm.sortOrder, 10) || 0,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message || "Edit failed");
      }
      const { group: updated } = (await res.json()) as {
        group: { id: string; name: string; minSelect: number; maxSelect: number; isRequired: boolean; sortOrder: number };
      };
      setGroups((prev) =>
        prev.map((g) =>
          g.id === editingGroupId ? { ...g, ...updated } : g
        )
      );
      setEditingGroupId(null);
    } catch (e) {
      setEditGroupError(e instanceof Error ? e.message : "Edit failed");
    } finally {
      setEditGroupSaving(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    const confirmed = window.confirm(
      `Delete "${groupName}" modifier group?\n\nAll options in the group will also be deleted and links from all products will be removed.`
    );
    if (!confirmed) return;
    setDeletingGroupId(groupId);
    try {
      const res = await fetch(`/api/admin/modifier-groups/${groupId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message || "Delete failed");
      }
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingGroupId(null);
    }
  };

  // ── Option actions ───────────────────────────────────────────────────────
  const handleAddOption = async () => {
    if (!addingOptionGroupId) return;
    setNewOptionSaving(true);
    setNewOptionError("");
    try {
      const res = await fetch(`/api/admin/modifier-groups/${addingOptionGroupId}/options`, {
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
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message || "Create failed");
      }
      const { option } = (await res.json()) as { option: ProductOption };
      const newOpt = { ...option, isLoyverseSynced: false };
      setGroups((prev) =>
        prev.map((g) =>
          g.id === addingOptionGroupId ? { ...g, options: [...g.options, newOpt] } : g
        )
      );
      setAddingOptionGroupId(null);
      setNewOptionForm(emptyOptionForm());
    } catch (e) {
      setNewOptionError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setNewOptionSaving(false);
    }
  };

  const handleEditOptionSave = async () => {
    if (!editingOptionId || !editOptionGroupId) return;
    setEditOptionSaving(true);
    setEditOptionError("");
    try {
      const res = await fetch(
        `/api/admin/modifier-groups/${editOptionGroupId}/options/${editingOptionId}`,
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
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message || "Edit failed");
      }
      const { option: updated } = (await res.json()) as { option: ProductOption };
      setGroups((prev) =>
        prev.map((g) =>
          g.id === editOptionGroupId
            ? {
                ...g,
                options: g.options.map((o) =>
                  o.id === editingOptionId ? { ...o, ...updated } : o
                ),
              }
            : g
        )
      );
      setEditingOptionId(null);
      setEditOptionGroupId(null);
    } catch (e) {
      setEditOptionError(e instanceof Error ? e.message : "Edit failed");
    } finally {
      setEditOptionSaving(false);
    }
  };

  const handleDeleteOption = async (groupId: string, optionId: string, optionName: string) => {
    const confirmed = window.confirm(`"${optionName}" Are you sure you want to delete this option?`);
    if (!confirmed) return;
    setDeletingOptionId(optionId);
    try {
      const res = await fetch(
        `/api/admin/modifier-groups/${groupId}/options/${optionId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message || "Delete failed");
      }
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId ? { ...g, options: g.options.filter((o) => o.id !== optionId) } : g
        )
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingOptionId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <h2 className="text-base font-semibold text-gray-900">Modifier Group Management</h2>
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
            + Add Group
          </button>
        )}
      </div>

      {addingGroup && (
        <GroupForm
          form={newGroupForm}
          onChange={setNewGroupForm}
          onSave={handleAddGroup}
          onCancel={() => setAddingGroup(false)}
          saving={newGroupSaving}
          error={newGroupError}
          saveLabel="Add Group"
        />
      )}

      {groups.length === 0 && !addingGroup && (
        <p className="text-sm text-gray-400 text-center py-4">
          No modifier groups registered. Try adding a group.
        </p>
      )}

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
                  saveLabel="Save"
                />
              </div>
            ) : (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-medium text-gray-900 text-sm">{group.name}</span>
                  {group.isLoyverseSynced && (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                      🔗 Loyverse
                    </span>
                  )}
                  {group.isRequired && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                      Required
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    Select {group.minSelect}~{group.maxSelect}
                  </span>
                  <span className="text-xs text-gray-400">Sort: {group.sortOrder}</span>
                  <span className="text-xs text-gray-400">{group.options.length} options</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingGroupId(group.id);
                      setEditGroupForm({
                        name: group.name,
                        minSelect: String(group.minSelect),
                        maxSelect: String(group.maxSelect),
                        isRequired: group.isRequired,
                        sortOrder: String(group.sortOrder),
                      });
                      setEditGroupError("");
                    }}
                    disabled={group.isLoyverseSynced}
                    className="px-2.5 py-1 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title={group.isLoyverseSynced ? "Cannot edit Loyverse-synced groups" : undefined}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteGroup(group.id, group.name)}
                    disabled={deletingGroupId === group.id || group.isLoyverseSynced}
                    className="px-2.5 py-1 text-xs text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title={group.isLoyverseSynced ? "Cannot delete Loyverse-synced groups" : undefined}
                  >
                    {deletingGroupId === group.id ? "Deleting......" : "Delete"}
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
                        saveLabel="Save"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3 flex-wrap text-sm">
                        <span className="text-gray-800">{option.name}</span>
                        <span className="text-gray-500 tabular-nums">
                          {option.priceDelta === 0
                            ? "Free"
                            : option.priceDelta > 0
                            ? `+$${option.priceDelta.toFixed(2)}`
                            : `-$${Math.abs(option.priceDelta).toFixed(2)}`}
                        </span>
                        {option.isLoyverseSynced && (
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">
                            🔗
                          </span>
                        )}
                        {!option.isActive && (
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-400 text-xs rounded-full">
                            Inactive
                          </span>
                        )}
                        {option.tracksInventory && (
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">
                            Inventory Tracking
                          </span>
                        )}
                        {option.sku && (
                          <span className="text-xs text-gray-400">SKU: {option.sku}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Link
                          href={`/admin/modifiers/${option.id}`}
                          className="px-2 py-1 text-xs text-gray-500 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                        >
                          Details
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingOptionId(option.id);
                            setEditOptionGroupId(group.id);
                            setEditOptionForm({
                              name: option.name,
                              priceDelta: String(option.priceDelta),
                              isActive: option.isActive,
                              sortOrder: String(option.sortOrder),
                              sku: option.sku ?? "",
                              tracksInventory: option.tracksInventory,
                            });
                            setEditOptionError("");
                          }}
                          disabled={option.isLoyverseSynced}
                          className="px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={option.isLoyverseSynced ? "Cannot edit Loyverse-synced options" : undefined}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteOption(group.id, option.id, option.name)}
                          disabled={deletingOptionId === option.id || option.isLoyverseSynced}
                          className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={option.isLoyverseSynced ? "Cannot delete Loyverse-synced options" : undefined}
                        >
                          {deletingOptionId === option.id ? "..." : "Delete"}
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
                    onCancel={() => {
                      setAddingOptionGroupId(null);
                      setNewOptionForm(emptyOptionForm());
                    }}
                    saving={newOptionSaving}
                    error={newOptionError}
                    saveLabel="Options Add"
                  />
                </div>
              ) : (
                <div className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAddingOptionGroupId(group.id);
                      setNewOptionForm(emptyOptionForm());
                      setNewOptionError("");
                    }}
                    className="text-xs text-amber-600 hover:text-amber-800 transition-colors font-medium"
                  >
                    + Add Option
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
