export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { getSupplierById } from "@/lib/services/supplierService";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ViewSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supplier = await getSupplierById(id);
  if (!supplier) notFound();

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/dashboard" className="hover:text-amber-600 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/suppliers" className="hover:text-amber-600 transition-colors">
            Suppliers
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">{supplier.name}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{supplier.name}</h1>
        <p className="text-gray-500 mt-0.5 text-sm">{supplier.slug}</p>
      </div>

      {/* Quick nav */}
      <div className="flex gap-2 text-sm flex-wrap">
        <Link
          href={`/suppliers/${id}/edit`}
          className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Edit Supplier
        </Link>
        {supplier.integrationType === "API" && (
          <Link
            href={`/suppliers/${id}/api`}
            className="px-3 py-1.5 rounded-md border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors"
          >
            API Integration
          </Link>
        )}
        {supplier.integrationType === "SCRAPER" && (
          <Link
            href={`/suppliers/${id}/scraper`}
            className="px-3 py-1.5 rounded-md border border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors"
          >
            Scraper Integration
          </Link>
        )}
      </div>

      {/* Details card */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="grid grid-cols-2 gap-x-6 px-5 py-4">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Integration Type</p>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
              {supplier.integrationType}
            </span>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Status</p>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                supplier.isActive
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {supplier.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        {supplier.websiteUrl && (
          <div className="px-5 py-4">
            <p className="text-xs text-gray-400 mb-0.5">Website</p>
            <a
              href={supplier.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-amber-600 hover:underline break-all"
            >
              {supplier.websiteUrl}
            </a>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-6 px-5 py-4">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Linked Ingredients</p>
            <p className="text-sm font-medium text-gray-900">
              {supplier.linkedIngredientCount}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Last Updated</p>
            <p className="text-sm text-gray-700">
              {new Date(supplier.updatedAt).toLocaleDateString("en-NZ")}
            </p>
          </div>
        </div>

        {supplier.notes && (
          <div className="px-5 py-4">
            <p className="text-xs text-gray-400 mb-0.5">Notes</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{supplier.notes}</p>
          </div>
        )}

        <div className="px-5 py-4">
          <p className="text-xs text-gray-400 mb-0.5">Created</p>
          <p className="text-sm text-gray-700">
            {new Date(supplier.createdAt).toLocaleDateString("en-NZ")}
          </p>
        </div>
      </div>
    </div>
  );
}
