"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { SupplierRow } from "@/lib/services/supplierService";

interface SupplierTableProps {
  suppliers: SupplierRow[];
}

export default function SupplierTable({ suppliers }: SupplierTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function toggleActive(supplier: SupplierRow) {
    setActionId(supplier.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !supplier.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.message ?? "Action failed" });
      } else {
        setMessage({ type: "success", text: "Status updated" });
        startTransition(() => router.refresh());
      }
    } catch {
      setMessage({ type: "error", text: "Failed to connect to server" });
    } finally {
      setActionId(null);
    }
  }

  const isLoading = isPending || actionId !== null;

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

      {suppliers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No suppliers found.</p>
          <p className="text-gray-400 text-xs mt-1">
            <Link href="/suppliers/new" className="text-amber-600 hover:underline">
              Add a supplier
            </Link>{" "}
            to get started.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Integration Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Website</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Active</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Linked Ingredients</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Updated</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {suppliers.map((supplier) => {
                  const isActing = actionId === supplier.id;
                  return (
                    <tr
                      key={supplier.id}
                      className={`hover:bg-gray-50 transition-colors ${isActing ? "opacity-60" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/suppliers/${supplier.id}`}
                          className="block font-medium text-gray-900 hover:text-amber-600 transition-colors"
                        >
                          {supplier.name}
                        </Link>
                        <div className="text-xs text-gray-400">{supplier.slug}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                          {supplier.integrationType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {supplier.websiteUrl ? (
                          <a
                            href={supplier.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-600 hover:underline truncate max-w-[200px] block"
                          >
                            {supplier.websiteUrl}
                          </a>
                        ) : (
                          <span className="text-gray-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            supplier.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {supplier.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {supplier.linkedIngredientCount}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(supplier.updatedAt).toLocaleDateString("en-NZ")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/suppliers/${supplier.id}/edit`}
                            className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            Edit
                          </Link>
                          {supplier.integrationType === "API" && (
                            <Link
                              href={`/suppliers/${supplier.id}/api`}
                              className="text-xs px-3 py-1.5 rounded-md border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              API Sync
                            </Link>
                          )}
                          <button
                            onClick={() => toggleActive(supplier)}
                            disabled={isLoading}
                            className={`text-xs px-3 py-1.5 rounded-md border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              supplier.isActive
                                ? "border-gray-300 text-gray-600 hover:bg-gray-50"
                                : "border-green-300 text-green-700 hover:bg-green-50"
                            }`}
                          >
                            {isActing ? "..." : supplier.isActive ? "Disable" : "Enable"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden divide-y divide-gray-100">
            {suppliers.map((supplier) => {
              const isActing = actionId === supplier.id;
              return (
                 <div key={supplier.id} className={`p-4 space-y-2 ${isActing ? "opacity-60" : ""}`}>
                   <div className="flex items-start justify-between gap-2">
                     <div>
                       <Link
                         href={`/suppliers/${supplier.id}`}
                         className="font-medium text-gray-900 hover:text-amber-600 transition-colors"
                       >
                         {supplier.name}
                       </Link>
                       <p className="text-xs text-gray-400">{supplier.slug}</p>
                     </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                        supplier.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {supplier.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>
                      <span className="text-gray-400">Type: </span>
                      <span className="text-blue-600">{supplier.integrationType}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Linked ingredients: </span>
                      <span>{supplier.linkedIngredientCount}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/suppliers/${supplier.id}/edit`}
                      className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                    {supplier.integrationType === "API" && (
                      <Link
                        href={`/suppliers/${supplier.id}/api`}
                        className="text-xs px-3 py-1.5 rounded-md border border-blue-300 text-blue-600 hover:bg-blue-50"
                      >
                        API Sync
                      </Link>
                    )}
                    <button
                      onClick={() => toggleActive(supplier)}
                      disabled={isLoading}
                      className={`text-xs px-3 py-1.5 rounded-md border font-medium transition-colors disabled:opacity-50 ${
                        supplier.isActive
                          ? "border-gray-300 text-gray-600 hover:bg-gray-50"
                          : "border-green-300 text-green-700 hover:bg-green-50"
                      }`}
                    >
                      {isActing ? "..." : supplier.isActive ? "Disable" : "Enable"}
                    </button>
                    <span className="text-xs text-gray-400 ml-auto">
                      {new Date(supplier.updatedAt).toLocaleDateString("en-NZ")}
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
