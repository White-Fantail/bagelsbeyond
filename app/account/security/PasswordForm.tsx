"use client";

import { useState, useTransition } from "react";

export default function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match" });
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/account/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
        });

        const data = await res.json();

        if (!res.ok) {
          setMessage({ type: "error", text: data.message ?? "Change failed" });
        } else {
          setMessage({ type: "success", text: "Password changed" });
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        }
      } catch {
        setMessage({ type: "error", text: "An error occurred while processing" });
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

      {/* Current password */}
      <div>
        <label
          htmlFor="currentPassword"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Current Password
        </label>
        <input
          id="currentPassword"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          placeholder="Current Password"
        />
      </div>

      {/* New password */}
      <div>
        <label
          htmlFor="newPassword"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          New Password
        </label>
        <input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          autoComplete="new-password"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          placeholder="At least 8 characters, including letters and numbers"
        />
      </div>

      {/* Confirm new password */}
      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Confirm New Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          placeholder="Re-enter new password"
        />
      </div>

      <button
        type="submit"
        disabled={isPending || !currentPassword || !newPassword || !confirmPassword}
        className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {isPending ? "Changing…" : "Change Password"}
      </button>
    </form>
  );
}
