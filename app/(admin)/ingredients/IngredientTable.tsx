"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { IngredientRow } from "@/lib/services/ingredientService";

interface IngredientTableProps {
  ingredients: IngredientRow[];
}

export default function IngredientTable({ ingredients }: IngredientTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function toggleActive(ingredient: IngredientRow) {
    setActionId(ingredient.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/ingredients/${ingredient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !ingredient.isActive }),
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

      {ingredients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No ingredients found.</p>
          <p className="text-gray-400 text-xs mt-1">
            Try adjusting the filters or{" "}
            <Link href="/ingredients/new" className="text-amber-600 hover:underline">
              add a new ingredient
            </Link>
            .
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
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Purchase Price</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Purchase Qty</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Purchase Unit</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Base Unit</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Yield %</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Converted Base Qty</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Standard Cost</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Conversion</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Tax</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Active</th>
                   <th className="text-left px-4 py-3 font-medium text-gray-600">Last Price Update</th>
                   <th className="text-right px-4 py-3 font-medium text-gray-600">Price Δ</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Suppliers</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Updated</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ingredients.map((ingredient) => {
                  const isActing = actionId === ingredient.id;
                  return (
                    <tr
                      key={ingredient.id}
                      className={`hover:bg-gray-50 transition-colors ${isActing ? "opacity-60" : ""}`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{ingredient.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {ingredient.categoryName ?? (
                          <span className="italic text-gray-400">Uncategorized</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-800 font-mono">
                        ${ingredient.purchasePrice}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 font-mono">
                        {ingredient.purchaseQuantity}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                          {ingredient.purchaseUnit}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                          {ingredient.baseUnit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        <span className={parseFloat(ingredient.yieldPercent) < 100 ? "text-amber-700 font-medium" : "text-gray-600"}>
                          {ingredient.yieldPercent}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 font-mono text-xs">
                        {ingredient.convertedBaseQuantity ?? (
                          <span className="text-gray-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-800 font-mono text-xs">
                        {ingredient.standardUnitDisplay ?? (
                          <span className="text-gray-400 italic">Unsupported</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {ingredient.conversionStatus === "ok" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            Unsupported
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {ingredient.taxIncluded ? (
                          <span className="text-green-600 text-xs">Yes</span>
                        ) : (
                          <span className="text-gray-400 text-xs">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            ingredient.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {ingredient.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {ingredient.lastPriceUpdatedAt
                          ? new Date(ingredient.lastPriceUpdatedAt).toLocaleDateString("en-NZ")
                          : <span className="italic">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {ingredient.lastPriceDelta !== null ? (() => {
                          const delta = parseFloat(ingredient.lastPriceDelta!);
                          return (
                            <span className={`text-xs font-mono ${delta > 0 ? "text-red-600" : delta < 0 ? "text-green-600" : "text-gray-500"}`}>
                              {delta > 0 ? "+" : ""}${Math.abs(delta).toFixed(2)}
                              {ingredient.lastPriceDeltaPct !== null && (
                                <span className="ml-1 text-gray-400">
                                  ({delta > 0 ? "+" : ""}{ingredient.lastPriceDeltaPct}%)
                                </span>
                              )}
                            </span>
                          );
                        })() : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/ingredients/${ingredient.id}/suppliers`}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                        >
                          {ingredient.primarySupplierName ?? "None"} ({ingredient.supplierLinkCount})
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(ingredient.updatedAt).toLocaleDateString("en-NZ")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/ingredients/${ingredient.id}/edit`}
                            className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => toggleActive(ingredient)}
                            disabled={isLoading}
                            className={`text-xs px-3 py-1.5 rounded-md border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              ingredient.isActive
                                ? "border-gray-300 text-gray-600 hover:bg-gray-50"
                                : "border-green-300 text-green-700 hover:bg-green-50"
                            }`}
                          >
                            {isActing
                              ? "..."
                              : ingredient.isActive
                              ? "Disable"
                              : "Enable"}
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
            {ingredients.map((ingredient) => {
              const isActing = actionId === ingredient.id;
              return (
                <div
                  key={ingredient.id}
                  className={`p-4 space-y-2 ${isActing ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{ingredient.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {ingredient.categoryName ?? "Uncategorized"}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                        ingredient.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {ingredient.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700">
                    <span className="font-mono font-semibold">${ingredient.purchasePrice}</span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span className="font-mono">{ingredient.purchaseQuantity}</span>
                    <span className="ml-1 text-xs text-blue-600">{ingredient.purchaseUnit}</span>
                    <span className="ml-2 text-xs text-gray-400">
                      base: <span className="text-purple-600">{ingredient.baseUnit}</span>
                    </span>
                    <span className="ml-2 text-xs">
                      yield:{" "}
                      <span className={parseFloat(ingredient.yieldPercent) < 100 ? "text-amber-700 font-medium" : "text-gray-500"}>
                        {ingredient.yieldPercent}%
                      </span>
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 space-y-0.5">
                    <div>
                      <span className="text-gray-400">Converted base qty: </span>
                      <span className="font-mono">
                        {ingredient.convertedBaseQuantity ?? (
                          <span className="italic text-gray-400">—</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">Standard cost: </span>
                      <span className="font-mono">
                        {ingredient.standardUnitDisplay ?? (
                          <span className="italic text-gray-400">Unsupported</span>
                        )}
                      </span>
                      {ingredient.conversionStatus === "ok" ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                          OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                          Unsupported
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/ingredients/${ingredient.id}/edit`}
                      className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => toggleActive(ingredient)}
                      disabled={isLoading}
                      className={`text-xs px-3 py-1.5 rounded-md border font-medium transition-colors disabled:opacity-50 ${
                        ingredient.isActive
                          ? "border-gray-300 text-gray-600 hover:bg-gray-50"
                          : "border-green-300 text-green-700 hover:bg-green-50"
                      }`}
                    >
                      {isActing ? "..." : ingredient.isActive ? "Disable" : "Enable"}
                    </button>
                    <span className="text-xs text-gray-400 ml-auto">
                      {new Date(ingredient.updatedAt).toLocaleDateString("en-NZ")}
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
