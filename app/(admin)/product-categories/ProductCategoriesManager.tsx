"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProductCategoryRow } from "@/lib/services/menuProductService";
import { slugify } from "@/lib/utils";

interface Props {
  initialCategories: ProductCategoryRow[];
}

type FormMode = { type: "create" } | { type: "edit"; category: ProductCategoryRow };

export default function ProductCategoriesManager({ initialCategories }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<FormMode | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [categories, setCategories] = useState(initialCategories);
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isFreshnessManaged, setIsFreshnessManaged] = useState(false);
  const [freshnessSortOrder, setFreshnessSortOrder] = useState("0");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  function openCreate() {
    setName("");
    setSlug("");
    setIsActive(true);
    setIsFreshnessManaged(false);
    setFreshnessSortOrder("0");
    setFormErrors({});
    setMessage(null);
    setMode({ type: "create" });
  }

  function openEdit(category: ProductCategoryRow) {
    setName(category.name);
    setSlug(category.slug);
    setIsActive(category.isActive);
    setIsFreshnessManaged(category.isFreshnessManaged);
    setFreshnessSortOrder(String(category.freshnessSortOrder));
    setFormErrors({});
    setMessage(null);
    setMode({ type: "edit", category });
  }

  function closeForm() {
    setMode(null);
    setFormErrors({});
  }

  function handleNameChange(val: string) {
    setName(val);
    if (mode?.type === "create") {
      setSlug(slugify(val));
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormErrors({});
    setMessage(null);

    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Name is required";
    if (!slug.trim()) errors.slug = "Slug is required";
    if (!/^[a-z0-9-]+$/.test(slug))
      errors.slug = "Slug must contain only lowercase letters, numbers, and hyphens";
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      isActive,
      isFreshnessManaged,
      freshnessSortOrder: parseInt(freshnessSortOrder) || 0,
    };

    startTransition(async () => {
      try {
        const isEdit = mode?.type === "edit";
        const url = isEdit
          ? `/api/admin/product-categories/${(mode as { type: "edit"; category: ProductCategoryRow }).category.id}`
          : "/api/admin/product-categories";
        const method = isEdit ? "PATCH" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok) {
          setMessage({ type: "error", text: data.message ?? "Action failed" });
          return;
        }

        setMessage({
          type: "success",
          text: isEdit ? "Category updated" : "Category created",
        });
        closeForm();
        startTransition(() => router.refresh());
      } catch {
        setMessage({ type: "error", text: "Failed to connect to server" });
      }
    });
  }

  function reorderCategoryList(
    list: ProductCategoryRow[],
    draggedId: string,
    targetId: string
  ): ProductCategoryRow[] {
    const from = list.findIndex((cat) => cat.id === draggedId);
    const to = list.findIndex((cat) => cat.id === targetId);
    if (from < 0 || to < 0 || from === to) return list;

    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  }

  function handleDragStart(categoryId: string) {
    setDraggedCategoryId(categoryId);
    setDragOverCategoryId(categoryId);
  }

  function handleDragOver(e: React.DragEvent, categoryId: string) {
    e.preventDefault();
    if (draggedCategoryId && draggedCategoryId !== categoryId) {
      setDragOverCategoryId(categoryId);
    }
  }

  function handleDragEnd() {
    setDraggedCategoryId(null);
    setDragOverCategoryId(null);
  }

  function submitReorderedCategories(previous: ProductCategoryRow[], reordered: ProductCategoryRow[]) {
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/product-categories/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryIds: reordered.map((category) => category.id) }),
        });
        const data = await res.json();
        if (!res.ok) {
          setCategories(previous);
          setMessage({ type: "error", text: data.message ?? "Failed to reorder categories" });
          return;
        }
        setMessage({ type: "success", text: "Display order updated" });
        router.refresh();
      } catch {
        setCategories(previous);
        setMessage({ type: "error", text: "Failed to connect to server" });
      }
    });
  }

  function handleDrop(targetCategoryId: string) {
    if (!draggedCategoryId || draggedCategoryId === targetCategoryId) {
      handleDragEnd();
      return;
    }

    const previous = categories;
    const reordered = reorderCategoryList(previous, draggedCategoryId, targetCategoryId);
    setCategories(reordered);
    setMessage(null);
    handleDragEnd();
    submitReorderedCategories(previous, reordered);
  }

  function moveCategory(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) {
      return;
    }

    const previous = categories;
    const reordered = [...previous];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    setCategories(reordered);
    setMessage(null);
    submitReorderedCategories(previous, reordered);
  }

  async function toggleCategoryActive(category: ProductCategoryRow) {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/product-categories/${category.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !category.isActive }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage({ type: "error", text: data.message ?? "Action failed" });
        } else {
          setMessage({ type: "success", text: "Status updated" });
          router.refresh();
        }
      } catch {
        setMessage({ type: "error", text: "Failed to connect to server" });
      }
    });
  }

  async function toggleCategoryFreshnessManaged(category: ProductCategoryRow) {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/product-categories/${category.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isFreshnessManaged: !category.isFreshnessManaged }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage({ type: "error", text: data.message ?? "Action failed" });
        } else {
          setMessage({ type: "success", text: "Freshness visibility updated" });
          router.refresh();
        }
      } catch {
        setMessage({ type: "error", text: "Failed to connect to server" });
      }
    });
  }

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const errorClass = "text-xs text-red-600 mt-1";

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {mode && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            {mode.type === "create" ? "New Category" : "Edit Category"}
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  disabled={isPending}
                  placeholder="e.g. Bagels"
                  className={inputClass}
                />
                {formErrors.name && <p className={errorClass}>{formErrors.name}</p>}
              </div>
              <div>
                <label className={labelClass}>
                  Slug <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  disabled={isPending}
                  placeholder="e.g. bagels"
                  className={inputClass}
                />
                {formErrors.slug && <p className={errorClass}>{formErrors.slug}</p>}
              </div>
              <div>
                <label className={labelClass}>Freshness Dashboard Order</label>
                <input
                  type="number"
                  value={freshnessSortOrder}
                  onChange={(e) => setFreshnessSortOrder(e.target.value)}
                  disabled={isPending}
                  min="0"
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2 text-xs text-gray-500">
                Display order on customer screens is managed by dragging rows in the category list.
              </div>
              <div className="flex items-end pb-1 gap-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    disabled={isPending}
                    className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFreshnessManaged}
                    onChange={(e) => setIsFreshnessManaged(e.target.checked)}
                    disabled={isPending}
                    className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-sm text-gray-700">Freshness Managed</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {isPending ? "Saving..." : mode.type === "create" ? "Create" : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={closeForm}
                disabled={isPending}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div>
            <span className="text-sm font-medium text-gray-600">{categories.length} categories</span>
            <p className="text-xs text-gray-500 mt-0.5">
              Drag rows to change display order (or use ↑ / ↓ buttons).
            </p>
          </div>
          {!mode && (
            <button
              onClick={openCreate}
              className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded-md font-medium hover:bg-amber-600 transition-colors"
            >
              + New Category
            </button>
          )}
        </div>

        {categories.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm">No categories yet.</p>
            <p className="text-gray-400 text-xs mt-1">
              Click &ldquo;New Category&rdquo; to create one.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">
              Product categories list. Drag rows or use move up and move down buttons to change
              customer display order.
            </caption>
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-center px-2 py-3 font-medium text-gray-600 w-10">↕</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Slug</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Loyverse</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Order</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Freshness</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Freshness Order</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Active</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {categories.map((cat, index) => (
                <tr
                  key={cat.id}
                  draggable={!isPending}
                  onDragStart={() => handleDragStart(cat.id)}
                  onDragOver={(e) => handleDragOver(e, cat.id)}
                  onDrop={() => handleDrop(cat.id)}
                  onDragEnd={handleDragEnd}
                  className={`transition-colors ${
                    dragOverCategoryId === cat.id && draggedCategoryId !== cat.id
                      ? "bg-amber-50"
                      : "hover:bg-gray-50"
                  } ${isPending ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}`}
                >
                  <td className="px-2 py-3 text-center text-gray-400 select-none" aria-hidden>
                    ⋮⋮
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{cat.name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{cat.slug}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        cat.loyverseId
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {cat.loyverseId ? "Linked" : "Manual"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{index}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        cat.isFreshnessManaged
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {cat.isFreshnessManaged ? "Managed" : "Hidden"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{cat.freshnessSortOrder}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        cat.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {cat.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => moveCategory(index, "up")}
                        disabled={isPending || index === 0}
                        aria-label={`Move ${cat.name} up`}
                        className="text-xs px-2 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveCategory(index, "down")}
                        disabled={isPending || index === categories.length - 1}
                        aria-label={`Move ${cat.name} down`}
                        className="text-xs px-2 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => openEdit(cat)}
                        disabled={isPending}
                        className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleCategoryFreshnessManaged(cat)}
                        disabled={isPending}
                        className={`text-xs px-3 py-1.5 rounded-md border font-medium transition-colors disabled:opacity-50 ${
                          cat.isFreshnessManaged
                            ? "border-gray-300 text-gray-600 hover:bg-gray-50"
                            : "border-blue-300 text-blue-700 hover:bg-blue-50"
                        }`}
                      >
                        {isPending ? "..." : cat.isFreshnessManaged ? "Hide from Freshness" : "Show in Freshness"}
                      </button>
                      <button
                        onClick={() => toggleCategoryActive(cat)}
                        disabled={isPending}
                        className={`text-xs px-3 py-1.5 rounded-md border font-medium transition-colors disabled:opacity-50 ${
                          cat.isActive
                            ? "border-gray-300 text-gray-600 hover:bg-gray-50"
                            : "border-green-300 text-green-700 hover:bg-green-50"
                        }`}
                      >
                        {isPending ? "..." : cat.isActive ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
