"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ModifierGroupWithOptions } from "@/lib/catalog/queries/modifiers";
import SourceBadge, { SOURCE_REF_PREVIEW_LENGTH } from "./SourceBadge";

interface ModifiersTableProps {
  groups: ModifierGroupWithOptions[];
}

function SelectRule({ min, max }: { min: number | null; max: number | null }) {
  if (min === null && max === null) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <span className="text-xs text-gray-700">
      {min ?? 0}–{max ?? "∞"}
    </span>
  );
}

export default function ModifiersTable({ groups }: ModifiersTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function callPatch(id: string, payload: { isActive: boolean }) {
    setActionId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/catalog/modifiers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.message ?? "Update failed" });
      } else {
        setMessage({ type: "success", text: "Changes saved" });
        startTransition(() => router.refresh());
      }
    } catch {
      setMessage({ type: "error", text: "Failed to connect to server" });
    } finally {
      setActionId(null);
    }
  }

  const isLoading = isPending || actionId !== null;

  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-400 text-sm font-medium">No modifier groups found</p>
        <p className="text-gray-400 text-xs mt-1">Sync from Loyverse to populate catalog data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-8"></th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Group Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Options</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Select Rule</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Linked Items</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Source</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Synced</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Active</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const isActing = actionId === group.id;
                const isExpanded = expandedIds.has(group.id);

                return (
                  <Fragment key={group.id}>
                    <tr
                      className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${isActing ? "opacity-60" : ""}`}
                    >
                      <td className="px-4 py-3">
                        {group.options.length > 0 && (
                          <button
                            onClick={() => toggleExpand(group.id)}
                            className="text-gray-400 hover:text-gray-600 transition-colors text-xs"
                            aria-label={isExpanded ? "Collapse options" : "Expand options"}
                          >
                            {isExpanded ? "▼" : "▶"}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{group.name}</p>
                        {group.description && (
                          <p className="text-xs text-gray-400 mt-0.5">{group.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${group.optionCount > 0 ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-400"}`}>
                          {group.optionCount}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <SelectRule min={group.minSelect} max={group.maxSelect} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${group.linkedItemCount > 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-400"}`}>
                          {group.linkedItemCount} item{group.linkedItemCount !== 1 ? "s" : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                      <SourceBadge channel={group.sourceChannel} sourceRef={group.sourceRef} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {group.syncedAt
                          ? new Date(group.syncedAt).toLocaleDateString("en-NZ")
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => callPatch(group.id, { isActive: !group.isActive })}
                          disabled={isLoading}
                          role="switch"
                          aria-checked={group.isActive}
                          aria-label={`Toggle active for ${group.name}`}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                            group.isActive ? "bg-amber-500" : "bg-gray-200"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                              group.isActive ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </td>
                    </tr>

                    {isExpanded && group.options.length > 0 && (
                      <tr key={`${group.id}-options`} className="border-b border-gray-50 bg-gray-50/50">
                        <td></td>
                        <td colSpan={7} className="px-4 py-3">
                          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-gray-100 bg-gray-50">
                                  <th className="text-left px-3 py-2 font-medium text-gray-500">Option Name</th>
                                  <th className="text-left px-3 py-2 font-medium text-gray-500">Price Delta</th>
                                  <th className="text-left px-3 py-2 font-medium text-gray-500">Default</th>
                                  <th className="text-left px-3 py-2 font-medium text-gray-500">Active</th>
                                  <th className="text-left px-3 py-2 font-medium text-gray-500">Source Ref</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {group.options.map((opt) => (
                                  <tr key={opt.id} className="hover:bg-gray-50/50">
                                    <td className="px-3 py-2 font-medium text-gray-800">{opt.name}</td>
                                    <td className="px-3 py-2 text-gray-700">
                                      {parseFloat(opt.priceDelta) === 0
                                        ? "—"
                                        : `+$${opt.priceDelta}`}
                                    </td>
                                    <td className="px-3 py-2">
                                      {opt.isDefault ? (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Default</span>
                                      ) : (
                                        <span className="text-gray-400">—</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${opt.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                        {opt.isActive ? "Yes" : "No"}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 font-mono text-gray-400 truncate max-w-[120px]" title={opt.sourceRef ?? ""}>
                                      {opt.sourceRef ? opt.sourceRef.slice(0, SOURCE_REF_PREVIEW_LENGTH) + "…" : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
