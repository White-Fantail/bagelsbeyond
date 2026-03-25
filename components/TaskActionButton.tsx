"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  href: string;
  label: string;
  body: Record<string, unknown>;
};

export default function TaskActionButton({ href, label, body }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setDone(false);
    setError(null);
    try {
      const res = await fetch(href, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "작업 실행에 실패했습니다");
      }
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors
        ${done
          ? "bg-green-50 border-green-200 text-green-700"
          : error
          ? "bg-red-50 border-red-200 text-red-700"
          : "bg-white border-gray-200 text-gray-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700"
        }
        disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {loading ? "실행 중…" : done ? "✓ 완료" : error ? `✗ ${error}` : label}
    </button>
  );
}
