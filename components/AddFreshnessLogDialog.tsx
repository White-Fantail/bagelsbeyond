"use client";

import { useState, useTransition } from "react";
import type { MenuProductRow } from "@/lib/services/menuProductService";
import type { FreshnessLogRow } from "@/lib/services/freshnessService";
import FreshnessLogForm from "./FreshnessLogForm";

interface AddFreshnessLogDialogProps {
  products: MenuProductRow[];
  log?: FreshnessLogRow;
  triggerLabel?: string;
  initialProductId?: string;
  lastQuantities?: Record<string, number>;
  onSubmit: (formData: FormData) => Promise<{ success?: boolean; message?: string; errors?: Record<string, string[]> }>;
}

export default function AddFreshnessLogDialog({
  products,
  log,
  triggerLabel,
  initialProductId,
  lastQuantities,
  onSubmit,
}: AddFreshnessLogDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [, startTransition] = useTransition();

  const isEditing = !!log;
  const isCompactTrigger = !isEditing && triggerLabel === "+";

  async function handleSubmit(formData: FormData) {
    const result = await onSubmit(formData);
    if (result.success) {
      startTransition(() => {
        setIsOpen(false);
      });
    }
    return result;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={isEditing ? "Edit log" : "Add log"}
        className={
          isEditing
            ? "text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            : isCompactTrigger
            ? "w-8 h-8 inline-flex items-center justify-center bg-amber-500 text-white rounded-md text-base font-semibold hover:bg-amber-600 transition-colors"
            : "px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 transition-colors"
        }
      >
        {triggerLabel ?? (isEditing ? "Edit" : "Add Log")}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={isEditing ? "Edit log" : "Add log"}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          />

          {/* Dialog */}
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {isEditing ? "Edit Log" : "Add Freshness Log"}
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5">
              <FreshnessLogForm
                products={products}
                log={log}
                initialProductId={initialProductId}
                lastQuantities={lastQuantities}
                onSubmit={handleSubmit}
                onCancel={() => setIsOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
