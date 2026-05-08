"use client";

import { useState, useTransition } from "react";
import { FreshnessLogType } from "@/app/generated/prisma/enums";
import type { MenuProductRow } from "@/lib/services/menuProductService";
import type { FreshnessLogRow } from "@/lib/services/freshnessService";

interface FreshnessLogFormProps {
  products: MenuProductRow[];
  log?: FreshnessLogRow;
  initialProductId?: string;
  onSubmit: (formData: FormData) => Promise<{ success?: boolean; message?: string; errors?: Record<string, string[]> }>;
  onCancel?: () => void;
}

function toLocalDatetimeValue(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nowLocalDatetime(): string {
  return toLocalDatetimeValue(new Date().toISOString());
}

const LOG_TYPE_LABELS: Record<FreshnessLogType, string> = {
  MADE: "Made",
  DISPLAYED: "Displayed",
};

export default function FreshnessLogForm({
  products,
  log,
  initialProductId,
  onSubmit,
  onCancel,
}: FreshnessLogFormProps) {
  const [isPending, startTransition] = useTransition();
  const isEditing = !!log;

  // Form fields
  const [productId, setProductId] = useState(log?.productId ?? initialProductId ?? "");
  const [logType, setLogType] = useState<FreshnessLogType>(
    log?.logType ?? FreshnessLogType.DISPLAYED
  );
  const [loggedAt, setLoggedAt] = useState(
    log ? toLocalDatetimeValue(log.loggedAt) : nowLocalDatetime()
  );
  const [notes, setNotes] = useState(log?.notes ?? "");

  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const errorClass = "text-xs text-red-600 mt-1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    const fd = new FormData();
    fd.set("productId", productId);
    fd.set("logType", logType);
    // Convert local datetime to ISO for server
    const d = new Date(loggedAt);
    fd.set("loggedAt", d.toISOString());
    fd.set("notes", notes);

    startTransition(async () => {
      const result = await onSubmit(fd);
      if (result.errors) {
        setErrors(result.errors);
      } else if (result.message) {
        setServerError(result.message);
      } else if (result.success) {
        setSuccess(true);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {serverError && (
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {serverError}
        </div>
      )}
      {success && (
        <div className="px-4 py-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">
          Saved.
        </div>
      )}

      {/* Product */}
      <div>
        <label className={labelClass}>
          Product <span className="text-red-500">*</span>
        </label>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          disabled={isPending}
          className={inputClass}
        >
          <option value="">Select a product...</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.categoryName ? ` (${p.categoryName})` : ""}
            </option>
          ))}
        </select>
        {errors.productId && <p className={errorClass}>{errors.productId[0]}</p>}
      </div>

      {/* Log type */}
      <div>
        <label className={labelClass}>
          Log Type <span className="text-red-500">*</span>
        </label>
        <select
          value={logType}
          onChange={(e) => setLogType(e.target.value as FreshnessLogType)}
          disabled={isPending}
          className={inputClass}
        >
          {Object.values(FreshnessLogType).map((t) => (
            <option key={t} value={t}>
              {LOG_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        {errors.logType && <p className={errorClass}>{errors.logType[0]}</p>}
      </div>

      {/* Logged at */}
      <div>
        <label className={labelClass}>
          Timestamp <span className="text-red-500">*</span>
        </label>
        <input
          type="datetime-local"
          value={loggedAt}
          onChange={(e) => setLoggedAt(e.target.value)}
          disabled={isPending}
          className={inputClass}
        />
        {errors.loggedAt && <p className={errorClass}>{errors.loggedAt[0]}</p>}
      </div>

      {/* Notes */}
      <div>
        <label className={labelClass}>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          disabled={isPending}
          placeholder="Additional notes..."
          className={inputClass + " resize-none"}
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending || success}
          className="px-5 py-2.5 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
        >
          {isPending ? "Saving..." : isEditing ? "Save Changes" : "Add Log"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-5 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
