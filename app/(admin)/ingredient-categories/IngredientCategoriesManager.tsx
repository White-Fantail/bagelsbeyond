"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IngredientCategoryRow } from "@/lib/services/ingredientService";

interface Props {
  initialCategories: IngredientCategoryRow[];
}

type FormMode = { type: "create" } | { type: "edit"; category: IngredientCategoryRow };

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function IngredientCategoriesManager({ initialCategories }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<FormMode | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  function openCreate() {
    setName("");
    setSlug("");
    setSortOrder("0");
    setIsActive(true);
    setFormErrors({});
    setMessage(null);
    setMode({ type: "create" });
  }

  function openEdit(category: IngredientCategoryRow) {
    setName(category.name);
    setSlug(category.slug);
    setSortOrder(String(category.sortOrder));
    setIsActive(category.isActive);
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
      sortOrder: parseInt(sortOrder) || 0,
      isActive,
    };

    startTransition(async () => {
      try {
        const isEdit = mode?.type === "edit";
        const url = isEdit
          ? `/api/admin/ingredient-categories/${(mode as { type: "edit"; category: IngredientCategoryRow }).category.id}`
          : "/api/admin/ingredient-categories";
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

  async function toggleCategoryActive(category: IngredientCategoryRow) {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/ingredient-categories/${category.id}`, {
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

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const errorClass = "text-xs text-red-600 mt-1";

  return (
    <div className="space-y-6">
      {/* Feedback */}
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

      {/* Create/Edit form */}
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
                  placeholder="e.g. Dairy"
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
                  placeholder="e.g. dairy"
                  className={inputClass}
                />
                {formErrors.slug && <p className={errorClass}>{formErrors.slug}</p>}
              </div>
              <div>
                <label className={labelClass}>Sort Order</label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  disabled={isPending}
                  min="0"
                  className={inputClass}
                />
              </div>
              <div className="flex items-end pb-1">
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

      {/* Category list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <span className="text-sm font-medium text-gray-600">
            {initialCategories.length} categories
          </span>
          {!mode && (
            <button
              onClick={openCreate}
              className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded-md font-medium hover:bg-amber-600 transition-colors"
            >
              + New Category
            </button>
          )}
        </div>

        {initialCategories.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm">No categories yet.</p>
            <p className="text-gray-400 text-xs mt-1">
              Click &ldquo;New Category&rdquo; to create one.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Slug</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Order</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Active</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {initialCategories.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{cat.name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{cat.slug}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{cat.sortOrder}</td>
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
                        onClick={() => openEdit(cat)}
                        disabled={isPending}
                        className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        Edit
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
