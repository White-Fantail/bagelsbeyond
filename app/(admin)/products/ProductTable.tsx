"use client";

import Link from "next/link";
import type { MenuProductRow } from "@/lib/services/menuProductService";

export default function ProductTable({ products }: { products: MenuProductRow[] }) {
  if (products.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-400 text-sm">No products found.</p>
        <Link href="/products/new" className="text-amber-600 hover:underline text-sm">Add the first product</Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Shelf Life</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Storage</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/products/${product.id}/edit`} className="text-gray-900 hover:text-amber-700 hover:underline">{product.name}</Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{product.categoryName ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{product.sku ?? "—"}</td>
                <td className="px-4 py-3 text-center">{product.shelfLifeDays != null ? `${product.shelfLifeDays} days` : "—"}</td>
                <td className="px-4 py-3 text-center">{product.storageType ?? "—"}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${product.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {product.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
