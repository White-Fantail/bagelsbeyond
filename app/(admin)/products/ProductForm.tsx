"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MenuProductRow, ProductCategoryRow } from "@/lib/services/menuProductService";
import { StorageType } from "@/app/generated/prisma/enums";

interface ProductFormProps {
  product?: MenuProductRow;
  categories: ProductCategoryRow[];
}

type FormErrors = Record<string, string | undefined>;

export default function ProductForm({ product, categories }: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [notes, setNotes] = useState(product?.notes ?? "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [shelfLifeDays, setShelfLifeDays] = useState(product?.shelfLifeDays != null ? String(product.shelfLifeDays) : "");
  const [storageType, setStorageType] = useState<string>(product?.storageType ?? "");
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const isEditing = !!product;
  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    const nextErrors: FormErrors = {};
    if (!name.trim()) nextErrors.name = "Name is required";
    const shelfLife = shelfLifeDays === "" ? null : Number.parseInt(shelfLifeDays, 10);
    if (shelfLife !== null && (!Number.isInteger(shelfLife) || shelfLife <= 0)) {
      nextErrors.shelfLifeDays = "Shelf life must be a positive integer";
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const payload = {
      name: name.trim(),
      sku: sku.trim() || null,
      notes: notes.trim() || null,
      isActive,
      categoryId: categoryId || null,
      shelfLifeDays: shelfLife,
      storageType: (storageType as StorageType) || null,
    };

    startTransition(async () => {
      try {
        const url = isEditing ? `/api/admin/products/${product.id}` : "/api/admin/products";
        const res = await fetch(url, {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setServerError(data.message ?? "Failed to save product");
          return;
        }
        router.push("/products");
        router.refresh();
      } catch {
        setServerError("Failed to connect to server");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {serverError && <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">{serverError}</div>}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Product Details</h2>
        <div>
          <label className={labelClass}>Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} disabled={isPending} />
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
        </div>
        <div>
          <label className={labelClass}>Category</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass} disabled={isPending}>
            <option value="">No Category</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>SKU</label>
          <input value={sku} onChange={(e) => setSku(e.target.value)} className={inputClass} disabled={isPending} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Shelf Life Days</label>
            <input type="number" min="1" step="1" value={shelfLifeDays} onChange={(e) => setShelfLifeDays(e.target.value)} className={inputClass} disabled={isPending} />
            {errors.shelfLifeDays && <p className="text-xs text-red-600 mt-1">{errors.shelfLifeDays}</p>}
          </div>
          <div>
            <label className={labelClass}>Storage Type</label>
            <select value={storageType} onChange={(e) => setStorageType(e.target.value)} className={inputClass} disabled={isPending}>
              <option value="">Not set</option>
              <option value={StorageType.FROZEN}>Frozen</option>
              <option value={StorageType.REFRIGERATED}>Refrigerated</option>
              <option value={StorageType.AMBIENT}>Ambient</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>Notes</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} disabled={isPending} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={isPending} />
          Active
        </label>
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={isPending} className="px-5 py-2.5 bg-amber-500 text-white rounded-md text-sm font-medium disabled:opacity-50">{isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Product"}</button>
        <button type="button" onClick={() => router.push("/products")} className="px-5 py-2.5 bg-white border border-gray-300 rounded-md text-sm">Cancel</button>
      </div>
    </form>
  );
}
