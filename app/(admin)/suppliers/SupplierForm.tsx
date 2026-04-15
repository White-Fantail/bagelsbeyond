"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SupplierIntegrationType } from "@/app/generated/prisma/enums";
import type { SupplierRow } from "@/lib/services/supplierService";

interface SupplierFormProps {
  supplier?: SupplierRow;
}

type FormErrors = Record<string, string | undefined>;

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const INTEGRATION_OPTIONS = Object.values(SupplierIntegrationType);

export default function SupplierForm({ supplier }: SupplierFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(supplier?.name ?? "");
  const [slug, setSlug] = useState(supplier?.slug ?? "");
  const [integrationType, setIntegrationType] = useState<string>(
    supplier?.integrationType ?? SupplierIntegrationType.MANUAL
  );
  const [websiteUrl, setWebsiteUrl] = useState(supplier?.websiteUrl ?? "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");
  const [isActive, setIsActive] = useState(supplier?.isActive ?? true);

  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isEditing = !!supplier;

  function handleNameChange(val: string) {
    setName(val);
    if (!isEditing && !slug) {
      setSlug(slugify(val));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    const newErrors: FormErrors = {};
    if (!name.trim()) newErrors.name = "Name is required";
    if (!slug.trim()) newErrors.slug = "Slug is required";
    else if (!/^[a-z0-9-]+$/.test(slug))
      newErrors.slug = "Slug must contain only lowercase letters, numbers, and hyphens";
    if (websiteUrl && !/^https?:\/\/.+/.test(websiteUrl))
      newErrors.websiteUrl = "Must be a valid URL";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload: Record<string, unknown> = {
      name,
      slug,
      integrationType,
      websiteUrl: websiteUrl || null,
      notes: notes || null,
      isActive,
    };

    startTransition(async () => {
      try {
        const url = isEditing
          ? `/api/admin/suppliers/${supplier.id}`
          : "/api/admin/suppliers";
        const method = isEditing ? "PATCH" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok) {
          if (data.errors?.fieldErrors) {
            const fieldErrors: FormErrors = {};
            for (const [key, msgs] of Object.entries(data.errors.fieldErrors)) {
              const arr = msgs as string[];
              if (arr.length > 0) fieldErrors[key] = arr[0];
            }
            setErrors(fieldErrors);
          } else {
            setServerError(data.message ?? "An error occurred");
          }
          return;
        }

        setSuccess(true);
        router.push("/suppliers");
        router.refresh();
      } catch {
        setServerError("Failed to connect to server");
      }
    });
  }

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50";
  const errorClass = "text-xs text-red-600 mt-1";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {serverError && (
        <div className="px-4 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">
          {serverError}
        </div>
      )}
      {success && (
        <div className="px-4 py-3 rounded-lg text-sm font-medium bg-green-50 text-green-700 border border-green-200">
          Saved successfully. Redirecting...
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Supplier Details
        </h2>

        <div>
          <label className={labelClass}>
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            disabled={isPending}
            placeholder="e.g. BakeryDirect NZ"
            className={inputClass}
          />
          {errors.name && <p className={errorClass}>{errors.name}</p>}
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
            placeholder="e.g. bakerydirect-nz"
            className={inputClass}
          />
          <p className="text-xs text-gray-400 mt-1">
            Lowercase letters, numbers, and hyphens only
          </p>
          {errors.slug && <p className={errorClass}>{errors.slug}</p>}
        </div>

        <div>
          <label className={labelClass}>Integration Type</label>
          <select
            value={integrationType}
            onChange={(e) => setIntegrationType(e.target.value)}
            disabled={isPending}
            className={inputClass}
          >
            {INTEGRATION_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Website URL</label>
          <input
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            disabled={isPending}
            placeholder="https://example.com"
            className={inputClass}
          />
          {errors.websiteUrl && <p className={errorClass}>{errors.websiteUrl}</p>}
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isPending}
            rows={3}
            placeholder="Internal notes..."
            className={inputClass + " resize-none"}
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            id="isActive"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            disabled={isPending}
            className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
          />
          <label htmlFor="isActive" className="text-sm text-gray-700">
            Active
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending || success}
          className="px-5 py-2.5 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Supplier"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/suppliers")}
          disabled={isPending}
          className="px-5 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
