"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  pauseSubscriptionAction,
  resumeSubscriptionAction,
  cancelSubscriptionAction,
  skipOccurrenceAction,
} from "@/app/actions/subscription";

interface SubscriptionActionsProps {
  subscriptionId?: string;
  status?: string;
  occurrenceId?: string;
  mode?: "skip";
}

export default function SubscriptionActions({
  subscriptionId,
  status,
  occurrenceId,
  mode,
}: SubscriptionActionsProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (mode === "skip" && occurrenceId) {
    return (
      <button
        onClick={() =>
          startTransition(async () => {
            await skipOccurrenceAction(occurrenceId);
            router.refresh();
          })
        }
        disabled={isPending}
        className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60"
      >
        {isPending ? "Processing..." : "Skip"}
      </button>
    );
  }

  if (!subscriptionId) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {status === "ACTIVE" && (
        <button
          onClick={() =>
            startTransition(async () => {
              await pauseSubscriptionAction(subscriptionId);
              router.refresh();
            })
          }
          disabled={isPending}
          className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-60 transition-colors"
        >
          {isPending ? "Processing..." : "Pause"}
        </button>
      )}
      {status === "PAUSED" && (
        <button
          onClick={() =>
            startTransition(async () => {
              await resumeSubscriptionAction(subscriptionId);
              router.refresh();
            })
          }
          disabled={isPending}
          className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm hover:bg-amber-600 disabled:opacity-60 transition-colors"
        >
          {isPending ? "Processing..." : "Resume"}
        </button>
      )}
      <button
        onClick={() => {
          if (!confirm("Cancel this subscription?")) return;
          startTransition(async () => {
            await cancelSubscriptionAction(subscriptionId);
            router.refresh();
          });
        }}
        disabled={isPending}
        className="px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50 disabled:opacity-60 transition-colors"
      >
        {isPending ? "Processing..." : "Cancel Subscription"}
      </button>
    </div>
  );
}
