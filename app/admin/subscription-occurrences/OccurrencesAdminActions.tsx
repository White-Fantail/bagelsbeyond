"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  date?: string;
  occurrenceId?: string;
  status?: string;
}

export default function OccurrencesAdminActions({ date, occurrenceId, status }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Per-occurrence actions
  if (occurrenceId) {
    return (
      <div className="flex gap-2">
        {status === "SCHEDULED" && (
          <button
            onClick={() =>
              startTransition(async () => {
                await fetch(`/api/admin/subscription-occurrences/${occurrenceId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "skip" }),
                });
                router.refresh();
              })
            }
            disabled={isPending}
            className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60"
          >
            Skip
          </button>
        )}
        {(status === "SCHEDULED" || status === "ORDER_CREATED") && (
          <button
            onClick={() =>
              startTransition(async () => {
                await fetch(`/api/admin/subscription-occurrences/${occurrenceId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "cancel" }),
                });
                router.refresh();
              })
            }
            disabled={isPending}
            className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            Cancel
          </button>
        )}
      </div>
    );
  }

  // Bulk actions (date-level)
  if (!date) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() =>
          startTransition(async () => {
            await fetch("/api/admin/subscription-occurrences", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ date, generateOrders: false }),
            });
            router.refresh();
          })
        }
        disabled={isPending}
        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
      >
        {isPending ? "Processing..." : "Create Occurrence"}
      </button>
      <button
        onClick={() =>
          startTransition(async () => {
            await fetch("/api/admin/subscription-occurrences", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ date, generateOrders: true }),
            });
            router.refresh();
          })
        }
        disabled={isPending}
        className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition-colors"
      >
        {isPending ? "Processing..." : "Orders Create"}
      </button>
    </div>
  );
}
