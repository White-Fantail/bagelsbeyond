"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { IngredientSupplierLinkRow } from "@/lib/services/supplierService";

interface IngredientSupplierLinksTableProps {
  links: IngredientSupplierLinkRow[];
  ingredientId: string;
}

export default function IngredientSupplierLinksTable({
  links,
  ingredientId,
}: IngredientSupplierLinksTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function toggleActive(link: IngredientSupplierLinkRow) {
    setActionId(link.id);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/ingredients/${ingredientId}/supplier-links/${link.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !link.isActive }),
        }
      );
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

  async function setPrimary(link: IngredientSupplierLinkRow) {
    setActionId(link.id);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/ingredients/${ingredientId}/supplier-links/${link.id}/set-primary`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.message ?? "Action failed" });
      } else {
        setMessage({ type: "success", text: "Primary supplier updated" });
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

      {links.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No supplier links yet.</p>
          <p className="text-gray-400 text-xs mt-1">
            <Link
              href={`/ingredients/${ingredientId}/suppliers/new`}
              className="text-amber-600 hover:underline"
            >
              Add a supplier link
            </Link>{" "}
            to get started.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Supplier</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Product Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Product Code</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">URL</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Pkg Qty</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Pkg Unit</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Base Unit</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Primary</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Sync Mode</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Active</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Updated</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {links.map((link) => {
                  const isActing = actionId === link.id;
                  return (
                    <tr
                      key={link.id}
                      className={`hover:bg-gray-50 transition-colors ${isActing ? "opacity-60" : ""}`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{link.supplierName}</td>
                      <td className="px-4 py-3 text-gray-700">{link.supplierProductName}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                        {link.supplierProductCode ?? <span className="italic text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {link.supplierProductUrl ? (
                          <a
                            href={link.supplierProductUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-600 hover:underline"
                          >
                            Link
                          </a>
                        ) : (
                          <span className="text-gray-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {link.supplierPackageQuantity ?? (
                          <span className="text-gray-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {link.supplierPackageUnit ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                            {link.supplierPackageUnit}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {link.supplierBaseUnit ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                            {link.supplierBaseUnit}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {link.isPrimary ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            Primary
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          {link.syncMode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            link.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {link.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(link.updatedAt).toLocaleDateString("en-NZ")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/ingredients/${ingredientId}/suppliers/${link.id}/edit`}
                            className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            Edit
                          </Link>
                          {!link.isPrimary && link.isActive && (
                            <button
                              onClick={() => setPrimary(link)}
                              disabled={isLoading}
                              className="text-xs px-3 py-1.5 rounded-md border border-amber-300 text-amber-700 hover:bg-amber-50 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isActing ? "..." : "Set Primary"}
                            </button>
                          )}
                          <button
                            onClick={() => toggleActive(link)}
                            disabled={isLoading}
                            className={`text-xs px-3 py-1.5 rounded-md border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              link.isActive
                                ? "border-gray-300 text-gray-600 hover:bg-gray-50"
                                : "border-green-300 text-green-700 hover:bg-green-50"
                            }`}
                          >
                            {isActing ? "..." : link.isActive ? "Disable" : "Enable"}
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
            {links.map((link) => {
              const isActing = actionId === link.id;
              return (
                <div key={link.id} className={`p-4 space-y-2 ${isActing ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{link.supplierName}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{link.supplierProductName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {link.isPrimary && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          Primary
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          link.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {link.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  {link.supplierProductCode && (
                    <p className="text-xs font-mono text-gray-500">Code: {link.supplierProductCode}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/ingredients/${ingredientId}/suppliers/${link.id}/edit`}
                      className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                    {!link.isPrimary && link.isActive && (
                      <button
                        onClick={() => setPrimary(link)}
                        disabled={isLoading}
                        className="text-xs px-3 py-1.5 rounded-md border border-amber-300 text-amber-700 hover:bg-amber-50 font-medium transition-colors disabled:opacity-50"
                      >
                        {isActing ? "..." : "Set Primary"}
                      </button>
                    )}
                    <button
                      onClick={() => toggleActive(link)}
                      disabled={isLoading}
                      className={`text-xs px-3 py-1.5 rounded-md border font-medium transition-colors disabled:opacity-50 ${
                        link.isActive
                          ? "border-gray-300 text-gray-600 hover:bg-gray-50"
                          : "border-green-300 text-green-700 hover:bg-green-50"
                      }`}
                    >
                      {isActing ? "..." : link.isActive ? "Disable" : "Enable"}
                    </button>
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
