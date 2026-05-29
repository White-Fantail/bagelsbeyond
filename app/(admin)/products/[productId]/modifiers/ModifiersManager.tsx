"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ModifierOption = {
  id: string;
  groupId: string;
  loyverseId: string | null;
  name: string;
  priceDelta: number;
  sortOrder: number;
  isActive: boolean;
};

type ModifierGroup = {
  id: string;
  productId: string;
  loyverseId: string | null;
  name: string;
  description: string | null;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  isActive: boolean;
  options: ModifierOption[];
};

interface Props {
  productId: string;
  initialGroups: ModifierGroup[];
}

type GroupFormState = {
  name: string;
  description: string;
  isRequired: boolean;
  minSelections: string;
  maxSelections: string;
  sortOrder: string;
  isActive: boolean;
};

type OptionFormState = {
  name: string;
  priceDelta: string;
  sortOrder: string;
  isActive: boolean;
};

const emptyGroupForm = (): GroupFormState => ({
  name: "",
  description: "",
  isRequired: false,
  minSelections: "0",
  maxSelections: "1",
  sortOrder: "0",
  isActive: true,
});

const emptyOptionForm = (): OptionFormState => ({
  name: "",
  priceDelta: "0",
  sortOrder: "0",
  isActive: true,
});

function priceDeltaDisplay(delta: string | number): string {
  const n = typeof delta === "string" ? parseFloat(delta) : delta;
  if (isNaN(n)) return "+$0.00";
  return n >= 0 ? `+$${n.toFixed(2)}` : `-$${Math.abs(n).toFixed(2)}`;
}

export default function ModifiersManager({ productId, initialGroups }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [groups, setGroups] = useState<ModifierGroup[]>(initialGroups);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Group form state
  const [groupForm, setGroupForm] = useState<GroupFormState | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupErrors, setGroupErrors] = useState<Record<string, string>>({});

  // Option form state: keyed by groupId
  const [optionForms, setOptionForms] = useState<Record<string, OptionFormState | null>>({});
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingOptionGroupId, setEditingOptionGroupId] = useState<string | null>(null);
  const [optionErrors, setOptionErrors] = useState<Record<string, string>>({});

  function openNewGroup() {
    setEditingGroupId(null);
    setGroupForm(emptyGroupForm());
    setGroupErrors({});
    setMessage(null);
  }

  function openEditGroup(group: ModifierGroup) {
    setEditingGroupId(group.id);
    setGroupForm({
      name: group.name,
      description: group.description ?? "",
      isRequired: group.isRequired,
      minSelections: String(group.minSelections),
      maxSelections: String(group.maxSelections),
      sortOrder: String(group.sortOrder),
      isActive: group.isActive,
    });
    setGroupErrors({});
    setMessage(null);
  }

  function closeGroupForm() {
    setGroupForm(null);
    setEditingGroupId(null);
    setGroupErrors({});
  }

  function openNewOption(groupId: string) {
    setEditingOptionId(null);
    setEditingOptionGroupId(groupId);
    setOptionForms((prev) => ({ ...prev, [groupId]: emptyOptionForm() }));
    setOptionErrors({});
    setMessage(null);
  }

  function openEditOption(group: ModifierGroup, option: ModifierOption) {
    setEditingOptionId(option.id);
    setEditingOptionGroupId(group.id);
    setOptionForms((prev) => ({
      ...prev,
      [group.id]: {
        name: option.name,
        priceDelta: String(option.priceDelta),
        sortOrder: String(option.sortOrder),
        isActive: option.isActive,
      },
    }));
    setOptionErrors({});
    setMessage(null);
  }

  function closeOptionForm(groupId: string) {
    setOptionForms((prev) => ({ ...prev, [groupId]: null }));
    setEditingOptionId(null);
    setEditingOptionGroupId(null);
    setOptionErrors({});
  }

  async function handleSaveGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!groupForm) return;
    setGroupErrors({});
    setMessage(null);

    const errors: Record<string, string> = {};
    if (!groupForm.name.trim()) errors.name = "Name is required";
    const min = parseInt(groupForm.minSelections);
    const max = parseInt(groupForm.maxSelections);
    if (isNaN(min) || min < 0) errors.minSelections = "Min must be ≥ 0";
    if (isNaN(max) || max < 1) errors.maxSelections = "Max must be ≥ 1";
    if (!isNaN(min) && !isNaN(max) && min > max) errors.minSelections = "Min cannot exceed max";
    if (Object.keys(errors).length > 0) {
      setGroupErrors(errors);
      return;
    }

    const payload = {
      name: groupForm.name.trim(),
      description: groupForm.description.trim() || null,
      isRequired: groupForm.isRequired,
      minSelections: parseInt(groupForm.minSelections),
      maxSelections: parseInt(groupForm.maxSelections),
      sortOrder: parseInt(groupForm.sortOrder) || 0,
      isActive: groupForm.isActive,
    };

    startTransition(async () => {
      try {
        const url = editingGroupId
          ? `/api/admin/products/${productId}/modifiers/${editingGroupId}`
          : `/api/admin/products/${productId}/modifiers`;
        const method = editingGroupId ? "PATCH" : "POST";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { group?: ModifierGroup; message?: string };
        if (!res.ok) {
          setMessage({ type: "error", text: data.message ?? "Failed to save modifier group" });
          return;
        }
        if (data.group) {
          if (editingGroupId) {
            setGroups((prev) => prev.map((g) => (g.id === editingGroupId ? data.group! : g)));
          } else {
            setGroups((prev) => [...prev, data.group!]);
          }
        }
        setMessage({ type: "success", text: editingGroupId ? "Group updated" : "Group created" });
        closeGroupForm();
        router.refresh();
      } catch {
        setMessage({ type: "error", text: "Failed to connect to server" });
      }
    });
  }

  function handleDeleteGroup(groupId: string) {
    if (!confirm("Delete this modifier group and all its options?")) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/products/${productId}/modifiers/${groupId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = (await res.json()) as { message?: string };
          setMessage({ type: "error", text: data.message ?? "Failed to delete group" });
          return;
        }
        setGroups((prev) => prev.filter((g) => g.id !== groupId));
        setMessage({ type: "success", text: "Group deleted" });
        router.refresh();
      } catch {
        setMessage({ type: "error", text: "Failed to connect to server" });
      }
    });
  }

  async function handleSaveOption(e: React.FormEvent, groupId: string) {
    e.preventDefault();
    const form = optionForms[groupId];
    if (!form) return;
    setOptionErrors({});
    setMessage(null);

    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Name is required";
    const price = parseFloat(form.priceDelta);
    if (isNaN(price)) errors.priceDelta = "Price must be a number";
    if (Object.keys(errors).length > 0) {
      setOptionErrors(errors);
      return;
    }

    const payload = {
      name: form.name.trim(),
      priceDelta: parseFloat(form.priceDelta) || 0,
      sortOrder: parseInt(form.sortOrder) || 0,
      isActive: form.isActive,
    };

    startTransition(async () => {
      try {
        const url =
          editingOptionId && editingOptionGroupId === groupId
            ? `/api/admin/products/${productId}/modifiers/${groupId}/options/${editingOptionId}`
            : `/api/admin/products/${productId}/modifiers/${groupId}/options`;
        const method = editingOptionId && editingOptionGroupId === groupId ? "PATCH" : "POST";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { option?: ModifierOption; message?: string };
        if (!res.ok) {
          setMessage({ type: "error", text: data.message ?? "Failed to save option" });
          return;
        }
        if (data.option) {
          setGroups((prev) =>
            prev.map((g) => {
              if (g.id !== groupId) return g;
              if (editingOptionId && editingOptionGroupId === groupId) {
                return { ...g, options: g.options.map((o) => (o.id === editingOptionId ? data.option! : o)) };
              }
              return { ...g, options: [...g.options, data.option!] };
            })
          );
        }
        setMessage({ type: "success", text: editingOptionId ? "Option updated" : "Option added" });
        closeOptionForm(groupId);
        router.refresh();
      } catch {
        setMessage({ type: "error", text: "Failed to connect to server" });
      }
    });
  }

  function handleDeleteOption(groupId: string, optionId: string) {
    if (!confirm("Delete this option?")) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/products/${productId}/modifiers/${groupId}/options/${optionId}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const data = (await res.json()) as { message?: string };
          setMessage({ type: "error", text: data.message ?? "Failed to delete option" });
          return;
        }
        setGroups((prev) =>
          prev.map((g) =>
            g.id === groupId ? { ...g, options: g.options.filter((o) => o.id !== optionId) } : g
          )
        );
        setMessage({ type: "success", text: "Option deleted" });
        router.refresh();
      } catch {
        setMessage({ type: "error", text: "Failed to connect to server" });
      }
    });
  }

  return (
    <div className="space-y-4">
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

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Modifier Groups</h2>
        <button
          type="button"
          onClick={openNewGroup}
          disabled={isPending || groupForm !== null}
          className="px-3 py-1.5 text-sm rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
        >
          + New Group
        </button>
      </div>

      {/* New/Edit Group Form */}
      {groupForm && !editingGroupId && (
        <GroupForm
          form={groupForm}
          errors={groupErrors}
          isPending={isPending}
          title="New Modifier Group"
          onChange={setGroupForm}
          onSave={handleSaveGroup}
          onCancel={closeGroupForm}
        />
      )}

      {groups.length === 0 && !groupForm && (
        <p className="text-sm text-gray-500">No modifier groups yet. Add one to get started.</p>
      )}

      {groups.map((group) => {
        const optionForm = optionForms[group.id];
        return (
          <div key={group.id} className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Group Header */}
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-800">{group.name}</span>
                {group.loyverseId && (
                  <span className="px-1.5 py-0.5 text-xs rounded bg-purple-100 text-purple-700 font-medium">
                    Loyverse
                  </span>
                )}
                {!group.isActive && (
                  <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-500">
                    Inactive
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {group.isRequired ? "Required" : "Optional"} · min {group.minSelections} / max{" "}
                  {group.maxSelections}
                </span>
                {group.description && (
                  <span className="text-xs text-gray-400 italic">{group.description}</span>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                {editingGroupId === group.id ? null : (
                  <>
                    <button
                      type="button"
                      onClick={() => openEditGroup(group)}
                      disabled={isPending || groupForm !== null}
                      className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(group.id)}
                      disabled={isPending}
                      className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Edit Group Form */}
            {editingGroupId === group.id && groupForm && (
              <div className="px-4 py-3 border-b border-gray-200 bg-yellow-50">
                <GroupForm
                  form={groupForm}
                  errors={groupErrors}
                  isPending={isPending}
                  title="Edit Modifier Group"
                  onChange={setGroupForm}
                  onSave={handleSaveGroup}
                  onCancel={closeGroupForm}
                />
              </div>
            )}

            {/* Options */}
            <div className="divide-y divide-gray-50">
              {group.options.length === 0 && !optionForm && (
                <p className="px-4 py-3 text-sm text-gray-400 italic">No options yet.</p>
              )}
              {group.options.map((opt) => {
                const isEditingThis =
                  editingOptionId === opt.id && editingOptionGroupId === group.id;
                return (
                  <div key={opt.id}>
                    {isEditingThis && optionForm ? (
                      <div className="px-4 py-3 bg-yellow-50">
                        <OptionForm
                          form={optionForm}
                          errors={optionErrors}
                          isPending={isPending}
                          title="Edit Option"
                          onChange={(f) => setOptionForms((prev) => ({ ...prev, [group.id]: f }))}
                          onSave={(e) => handleSaveOption(e, group.id)}
                          onCancel={() => closeOptionForm(group.id)}
                        />
                      </div>
                    ) : (
                      <div className="px-4 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-800">{opt.name}</span>
                          {opt.loyverseId && (
                            <span className="px-1 py-0.5 text-xs rounded bg-purple-50 text-purple-600">
                              Loyverse
                            </span>
                          )}
                          {!opt.isActive && (
                            <span className="px-1 py-0.5 text-xs rounded bg-gray-100 text-gray-400">
                              Inactive
                            </span>
                          )}
                          <span className="text-xs text-gray-500">{priceDeltaDisplay(opt.priceDelta)}</span>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditOption(group, opt)}
                            disabled={isPending || optionForm !== null}
                            className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOption(group.id, opt.id)}
                            disabled={isPending}
                            className="text-xs px-2 py-0.5 rounded border border-red-100 text-red-500 hover:bg-red-50 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add New Option Form */}
              {optionForm && editingOptionId === null && editingOptionGroupId === group.id && (
                <div className="px-4 py-3 bg-blue-50">
                  <OptionForm
                    form={optionForm}
                    errors={optionErrors}
                    isPending={isPending}
                    title="New Option"
                    onChange={(f) => setOptionForms((prev) => ({ ...prev, [group.id]: f }))}
                    onSave={(e) => handleSaveOption(e, group.id)}
                    onCancel={() => closeOptionForm(group.id)}
                  />
                </div>
              )}

              {/* Add Option Button */}
              {!optionForm && (
                <div className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => openNewOption(group.id)}
                    disabled={isPending}
                    className="text-xs text-amber-600 hover:text-amber-700 font-medium disabled:opacity-50"
                  >
                    + Add option
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sub-forms ────────────────────────────────────────────────────────────────

function GroupForm({
  form,
  errors,
  isPending,
  title,
  onChange,
  onSave,
  onCancel,
}: {
  form: GroupFormState;
  errors: Record<string, string>;
  isPending: boolean;
  title: string;
  onChange: (f: GroupFormState) => void;
  onSave: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSave} className="space-y-3">
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-0.5">Name *</label>
          <input
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm"
            placeholder="e.g. Size"
          />
          {errors.name && <p className="text-xs text-red-600 mt-0.5">{errors.name}</p>}
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-0.5">Description</label>
          <input
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-0.5">Min Selections</label>
          <input
            type="number"
            min={0}
            value={form.minSelections}
            onChange={(e) => onChange({ ...form, minSelections: e.target.value })}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm"
          />
          {errors.minSelections && <p className="text-xs text-red-600 mt-0.5">{errors.minSelections}</p>}
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-0.5">Max Selections</label>
          <input
            type="number"
            min={1}
            value={form.maxSelections}
            onChange={(e) => onChange({ ...form, maxSelections: e.target.value })}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm"
          />
          {errors.maxSelections && <p className="text-xs text-red-600 mt-0.5">{errors.maxSelections}</p>}
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-0.5">Sort Order</label>
          <input
            type="number"
            min={0}
            value={form.sortOrder}
            onChange={(e) => onChange({ ...form, sortOrder: e.target.value })}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div className="flex items-center gap-4 pt-4">
          <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isRequired}
              onChange={(e) => onChange({ ...form, isRequired: e.target.checked })}
              className="rounded"
            />
            Required
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => onChange({ ...form, isActive: e.target.checked })}
              className="rounded"
            />
            Active
          </label>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-3 py-1.5 text-sm rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Group"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function OptionForm({
  form,
  errors,
  isPending,
  title,
  onChange,
  onSave,
  onCancel,
}: {
  form: OptionFormState;
  errors: Record<string, string>;
  isPending: boolean;
  title: string;
  onChange: (f: OptionFormState) => void;
  onSave: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSave} className="space-y-2">
      <p className="text-xs font-semibold text-gray-700">{title}</p>
      <div className="flex gap-2 flex-wrap items-end">
        <div>
          <label className="block text-xs text-gray-600 mb-0.5">Name *</label>
          <input
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            className="px-2 py-1 border border-gray-300 rounded text-sm w-44"
            placeholder="e.g. Large"
          />
          {errors.name && <p className="text-xs text-red-600 mt-0.5">{errors.name}</p>}
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-0.5">Price Δ ($)</label>
          <input
            type="number"
            step="0.01"
            value={form.priceDelta}
            onChange={(e) => onChange({ ...form, priceDelta: e.target.value })}
            className="px-2 py-1 border border-gray-300 rounded text-sm w-24"
            placeholder="0.00"
          />
          {errors.priceDelta && <p className="text-xs text-red-600 mt-0.5">{errors.priceDelta}</p>}
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-0.5">Sort</label>
          <input
            type="number"
            min={0}
            value={form.sortOrder}
            onChange={(e) => onChange({ ...form, sortOrder: e.target.value })}
            className="px-2 py-1 border border-gray-300 rounded text-sm w-16"
          />
        </div>
        <label className="flex items-center gap-1 text-xs text-gray-700 cursor-pointer pb-1">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => onChange({ ...form, isActive: e.target.checked })}
            className="rounded"
          />
          Active
        </label>
        <div className="flex gap-1.5 pb-0.5">
          <button
            type="submit"
            disabled={isPending}
            className="px-2.5 py-1 text-xs rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {isPending ? "..." : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
