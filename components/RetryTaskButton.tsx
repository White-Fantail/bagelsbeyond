"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  taskId: string;
  currentStatus: string;
};

export default function RetryTaskButton({ taskId, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canRetry = ["failed", "partial"].includes(currentStatus);

  if (!canRetry) return null;

  const handleRetry = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/retry`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Retry failed");
      }
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleRetry}
        disabled={loading || done}
        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Retrying…" : done ? "✓ Retry complete" : "🔄 Retry"}
      </button>
      {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
    </div>
  );
}
