"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Role = "ADMIN" | "STAFF" | "CUSTOMER";

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

interface UserTableProps {
  users: User[];
  currentUserId: string;
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "ADMIN",
  STAFF: "STAFF",
  CUSTOMER: "CUSTOMER",
};

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: "bg-red-100 text-red-700",
  STAFF: "bg-blue-100 text-blue-700",
  CUSTOMER: "bg-gray-100 text-gray-600",
};

const ALL_ROLES: Role[] = ["ADMIN", "STAFF", "CUSTOMER"];

export default function UserTable({ users, currentUserId }: UserTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function callPatch(userId: string, payload: { role?: Role; isActive?: boolean }) {
    setActionUserId(userId);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.message ?? "처리에 실패했습니다" });
      } else {
        setMessage({ type: "success", text: "변경사항이 저장되었습니다" });
        startTransition(() => {
          router.refresh();
        });
      }
    } catch {
      setMessage({ type: "error", text: "서버 연결에 실패했습니다" });
    } finally {
      setActionUserId(null);
    }
  }

  function handleRoleChange(user: User, newRole: Role) {
    if (newRole === user.role) return;
    callPatch(user.id, { role: newRole });
  }

  function handleToggleActive(user: User) {
    callPatch(user.id, { isActive: !user.isActive });
  }

  const isLoading = isPending || actionUserId !== null;

  return (
    <div className="space-y-3">
      {/* Feedback banner */}
      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {users.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">검색 결과가 없습니다.</p>
          <p className="text-gray-400 text-xs mt-1">검색어 또는 필터를 변경해 보세요.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">이름</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">이메일</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">권한</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">가입일</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((user) => {
                  const isSelf = user.id === currentUserId;
                  const isActing = actionUserId === user.id;
                  return (
                    <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${isActing ? "opacity-60" : ""}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {user.name}
                        {isSelf && (
                          <span className="ml-1.5 text-xs text-amber-600 font-normal">(나)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{user.email}</td>
                      <td className="px-4 py-3">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user, e.target.value as Role)}
                          disabled={isLoading}
                          className={`text-xs px-2 py-1 rounded-md border font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed ${ROLE_COLORS[user.role]} border-transparent`}
                          aria-label={`${user.name}의 권한 변경`}
                        >
                          {ALL_ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            user.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {user.isActive ? "활성" : "비활성"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleToggleActive(user)}
                          disabled={isLoading}
                          className={`text-xs px-3 py-1.5 rounded-md border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            user.isActive
                              ? "border-gray-300 text-gray-600 hover:bg-gray-50"
                              : "border-green-300 text-green-700 hover:bg-green-50"
                          }`}
                          aria-label={user.isActive ? `${user.name} 비활성화` : `${user.name} 활성화`}
                        >
                          {isActing ? "처리 중…" : user.isActive ? "비활성화" : "활성화"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              const isActing = actionUserId === user.id;
              return (
                <div key={user.id} className={`p-4 space-y-3 ${isActing ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">
                        {user.name}
                        {isSelf && (
                          <span className="ml-1.5 text-xs text-amber-600 font-normal">(나)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                        user.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {user.isActive ? "활성" : "비활성"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user, e.target.value as Role)}
                      disabled={isLoading}
                      className={`text-xs px-2 py-1.5 rounded-md border font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 ${ROLE_COLORS[user.role]} border-transparent`}
                      aria-label={`${user.name}의 권한 변경`}
                    >
                      {ALL_ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleToggleActive(user)}
                      disabled={isLoading}
                      className={`text-xs px-3 py-1.5 rounded-md border font-medium transition-colors disabled:opacity-50 ${
                        user.isActive
                          ? "border-gray-300 text-gray-600 hover:bg-gray-50"
                          : "border-green-300 text-green-700 hover:bg-green-50"
                      }`}
                    >
                      {isActing ? "처리 중…" : user.isActive ? "비활성화" : "활성화"}
                    </button>
                    <span className="text-xs text-gray-400 ml-auto">
                      {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
