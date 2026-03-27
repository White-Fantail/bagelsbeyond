"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  subscriptionId: string;
  currentStatus: string;
}

export default function AdminSubscriptionStatusForm({ subscriptionId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleStatusChange = (status: string) => {
    startTransition(async () => {
      await fetch(`/api/admin/subscriptions/${subscriptionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
      <span className="text-xs text-gray-500 self-center">Change Status:</span>
      {currentStatus !== "ACTIVE" && (
        <button
          onClick={() => handleStatusChange("ACTIVE")}
          disabled={isPending}
          className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-60"
        >
          Activate
        </button>
      )}
      {currentStatus !== "PAUSED" && (
        <button
          onClick={() => handleStatusChange("PAUSED")}
          disabled={isPending}
          className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 disabled:opacity-60"
        >
          Pause
        </button>
      )}
      <button
        onClick={() => {
          if (!confirm("Cancel this subscription?")) return;
          handleStatusChange("CANCELLED");
        }}
        disabled={isPending}
        className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 disabled:opacity-60"
      >
        {isPending ? "Processing..." : "Cancel"}
      </button>
    </div>
  );
}
