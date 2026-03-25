"use client";

import { useState, useTransition } from "react";

interface Props {
  currentName: string;
  currentEmail: string;
}

export default function ProfileForm({ currentName, currentEmail }: Props) {
  const [name, setName] = useState(currentName);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/account/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });

        const data = await res.json();

        if (!res.ok) {
          setMessage({ type: "error", text: data.message ?? "수정에 실패했습니다" });
        } else {
          setMessage({ type: "success", text: "프로필이 업데이트되었습니다" });
        }
      } catch {
        setMessage({ type: "error", text: "요청 중 오류가 발생했습니다" });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm border ${
            message.type === "success"
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          이름
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          placeholder="이름을 입력하세요"
        />
      </div>

      {/* Email — read-only */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          이메일
          <span className="ml-2 text-xs text-gray-400 font-normal">(변경 불가)</span>
        </label>
        <input
          id="email"
          type="email"
          value={currentEmail}
          readOnly
          disabled
          className="w-full px-3 py-2 border border-gray-200 rounded-lg shadow-sm text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
        />
      </div>

      <button
        type="submit"
        disabled={isPending || name.trim() === ""}
        className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {isPending ? "저장 중…" : "저장"}
      </button>
    </form>
  );
}
