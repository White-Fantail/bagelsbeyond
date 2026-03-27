"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { z } from "zod";
import Link from "next/link";

const productFormSchema = z.object({
  name: z.string().min(1, "Product Please enter your name"),
  slug: z
    .string()
    .min(1, "Please enter a slug")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  description: z.string().optional(),
  loyverseCategoryId: z.string().nullable().optional(),
  basePrice: z.coerce.number().min(0, "Price must be 0 or more"),
  isActive: z.boolean(),
  isSubscriptionEligible: z.boolean(),
  sortOrder: z.coerce.number().int(),
});

type ProductFormSchema = z.infer<typeof productFormSchema>;

export type CategoryOption = {
  id: string;
  name: string;
  color?: string | null;
};

export type ProductFormData = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  loyverseCategoryId?: string | null;
  basePrice: number;
  isActive: boolean;
  isSubscriptionEligible: boolean;
  sortOrder: number;
  /** True when the product has a Loyverse ExternalProductMap entry */
  isLoyverseSynced?: boolean;
  /** The external Loyverse product ID, if mapped */
  externalProductId?: string | null;
};

export default function ProductForm({
  product,
  mode,
}: {
  product?: ProductFormData;
  mode: "create" | "edit";
}) {
  const isLoyverseSynced = product?.isLoyverseSynced ?? false;
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  useEffect(() => {
    fetch("/api/admin/categories")
      .then((r) => r.json())
      .then((data: { categories?: CategoryOption[] }) => {
        if (data.categories) setCategories(data.categories);
      })
      .catch(() => {});
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductFormSchema>({
    resolver: zodResolver(productFormSchema) as Resolver<ProductFormSchema>,
    defaultValues: product
      ? {
          name: product.name,
          slug: product.slug,
          description: product.description ?? "",
          loyverseCategoryId: product.loyverseCategoryId ?? null,
          basePrice: product.basePrice,
          isActive: product.isActive,
          isSubscriptionEligible: product.isSubscriptionEligible,
          sortOrder: product.sortOrder,
        }
      : {
          name: "",
          slug: "",
          description: "",
          loyverseCategoryId: null,
          basePrice: 0,
          isActive: true,
          isSubscriptionEligible: false,
          sortOrder: 0,
        },
  });

  const onSubmit = async (data: ProductFormSchema) => {
    setStatus("loading");
    setErrorMessage("");
    try {
      const url =
        mode === "edit" && product
          ? `/api/admin/products/${product.id}`
          : "/api/admin/products";
      const method = mode === "edit" ? "PATCH" : "POST";

      // For Loyverse-synced products, only send editable fields
      const payload =
        isLoyverseSynced && mode === "edit"
          ? {
              isActive: data.isActive,
              isSubscriptionEligible: data.isSubscriptionEligible,
              sortOrder: data.sortOrder,
            }
          : data;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Save failed");
      }
      setStatus("success");
      setTimeout(() => {
        router.push("/admin/products");
      }, 1200);
    } catch (e) {
      setStatus("error");
      setErrorMessage(e instanceof Error ? e.message : "Save failed");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {status === "success" && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          ✅ Saved. Redirecting to products list...
        </div>
      )}
      {status === "error" && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ❌ {errorMessage}
        </div>
      )}

      {/* Loyverse sync badge */}
      {isLoyverseSynced && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <span className="text-lg leading-none">🔗</span>
          <div>
            <p className="font-semibold">Synced from Loyverse</p>
            <p className="mt-0.5 text-blue-700">
              This product is synced from Loyverse. Original fields (Name, slug, Description,
              base price) cannot be edited. Only internal operation fields can be modified.
            </p>
            {product?.externalProductId && (
              <p className="mt-1 text-xs text-blue-600 font-mono">
                Loyverse ID: {product.externalProductId}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Default Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <h2 className="text-base font-semibold text-gray-900">Default Info</h2>
          {isLoyverseSynced && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              🔒 Loyverse Original (Read-only)
            </span>
          )}
        </div>

        <Field label="Product Name *" error={errors.name?.message}>
          <input
            type="text"
            placeholder="e.g. Plain Bagel"
            {...register("name")}
            disabled={isLoyverseSynced}
            className={isLoyverseSynced ? readOnlyInputClass : inputClass(!!errors.name)}
          />
          {isLoyverseSynced && (
            <p className="mt-1 text-xs text-blue-500">🔒 Loyverse original field — Read-only</p>
          )}
        </Field>

        <Field
          label="slug *"
          error={errors.slug?.message}
          hint={isLoyverseSynced ? undefined : "Lowercase letters, numbers, hyphens only (e.g. plain-bagel)"}
        >
          <input
            type="text"
            placeholder="plain-bagel"
            {...register("slug")}
            disabled={isLoyverseSynced}
            className={isLoyverseSynced ? readOnlyInputClass : inputClass(!!errors.slug)}
          />
          {isLoyverseSynced && (
            <p className="mt-1 text-xs text-blue-500">🔒 Loyverse original field — Read-only</p>
          )}
        </Field>

        <Field label="Description" error={errors.description?.message}>
          <textarea
            rows={3}
            placeholder="Enter product description (optional)"
            {...register("description")}
            disabled={isLoyverseSynced}
            className={isLoyverseSynced ? readOnlyInputClass : inputClass(false)}
          />
          {isLoyverseSynced && (
            <p className="mt-1 text-xs text-blue-500">🔒 Loyverse original field — Read-only</p>
          )}
        </Field>

        <Field label="Categories" error={errors.loyverseCategoryId?.message}>
          <select
            {...register("loyverseCategoryId")}
            disabled={isLoyverseSynced}
            className={isLoyverseSynced ? readOnlyInputClass : inputClass(!!errors.loyverseCategoryId)}
          >
            <option value="">Categories None</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          {isLoyverseSynced && (
            <p className="mt-1 text-xs text-blue-500">🔒 Loyverse original field — Read-only</p>
          )}
        </Field>
      </div>

      {/* Price & Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <h2 className="text-base font-semibold text-gray-900">Price & Status</h2>
          {isLoyverseSynced && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
              ✏️ Internal Operation Fields (Editable)
            </span>
          )}
        </div>

        <Field label="base price *" error={errors.basePrice?.message}>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...register("basePrice")}
            disabled={isLoyverseSynced}
            onFocus={(e) => e.target.select()}
            className={isLoyverseSynced ? readOnlyInputClass : inputClass(!!errors.basePrice)}
          />
          {isLoyverseSynced && (
            <p className="mt-1 text-xs text-blue-500">🔒 Loyverse original field — Read-only</p>
          )}
        </Field>

        <Field label="Sort Order" error={errors.sortOrder?.message}>
          <input
            type="number"
            step="1"
            {...register("sortOrder")}
            onFocus={(e) => e.target.select()}
            className={inputClass(!!errors.sortOrder)}
          />
          {isLoyverseSynced && (
            <p className="mt-1 text-xs text-green-600">✏️ Internal operation field — Editable</p>
          )}
        </Field>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register("isActive")}
              className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-sm font-medium text-gray-700">Active Status</span>
            {isLoyverseSynced && (
              <span className="text-xs text-green-600">✏️ Edit Available</span>
            )}
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register("isSubscriptionEligible")}
              className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-sm font-medium text-gray-700">Subscribable Products</span>
            {isLoyverseSynced && (
              <span className="text-xs text-green-600">✏️ Edit Available</span>
            )}
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={status === "loading" || status === "success"}
          className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          {status === "loading" ? "Saving......" : "Save"}
        </button>
        <Link
          href="/admin/products"
          className="px-6 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function inputClass(hasError: boolean) {
  return `w-full px-3 py-2 border rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
    hasError ? "border-red-300 bg-red-50" : "border-gray-300"
  }`;
}

const readOnlyInputClass =
  "w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-500 bg-gray-50 cursor-not-allowed";

