"use client";

import { useTransition } from "react";
import type { FreshnessLogRow } from "@/lib/services/freshnessService";
import type { MenuProductRow } from "@/lib/services/menuProductService";
import AddFreshnessLogDialog from "./AddFreshnessLogDialog";

const LOG_TYPE_LABELS: Record<string, string> = {
  MADE: "Made",
  DISPLAYED: "Displayed",
};

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface FreshnessLogTableProps {
  logs: FreshnessLogRow[];
  products: MenuProductRow[];
  lastQuantities?: Record<string, number>;
  onUpdate: (id: string, formData: FormData) => Promise<{ success?: boolean; message?: string; errors?: Record<string, string[]> }>;
  onDelete: (id: string) => Promise<{ success?: boolean; message?: string }>;
}

function DeleteButton({
  id,
  onDelete,
}: {
  id: string;
  onDelete: (id: string) => Promise<{ success?: boolean; message?: string }>;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Delete this log?")) return;
    startTransition(async () => {
      await onDelete(id);
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="text-xs px-2.5 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
    >
      {isPending ? "..." : "Delete"}
    </button>
  );
}

export default function FreshnessLogTable({
  logs,
  products,
  lastQuantities,
  onUpdate,
  onDelete,
}: FreshnessLogTableProps) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">📋</p>
        <p className="text-sm">No logs found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              Product
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              Timestamp
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              Qty
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">
              Notes
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">
              Created By
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <p className="font-medium text-gray-900">{log.productName}</p>
                {log.categoryName && (
                  <p className="text-xs text-gray-400">{log.categoryName}</p>
                )}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    log.logType === "DISPLAYED"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-purple-100 text-purple-700"
                  }`}
                >
                  {LOG_TYPE_LABELS[log.logType] ?? log.logType}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                {formatDate(log.loggedAt)}
              </td>
              <td className="px-4 py-3 text-gray-700">
                {log.quantity != null ? log.quantity : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate hidden sm:table-cell">
                {log.notes || <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                {log.createdByUserName || <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <AddFreshnessLogDialog
                    products={products}
                    log={log}
                    triggerLabel="Edit"
                    lastQuantities={lastQuantities}
                    onSubmit={(fd) => onUpdate(log.id, fd)}
                  />
                  <DeleteButton id={log.id} onDelete={onDelete} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
