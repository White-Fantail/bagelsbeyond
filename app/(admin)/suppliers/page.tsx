export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { listSuppliers } from "@/lib/services/supplierService";
import Link from "next/link";
import SupplierTable from "./SupplierTable";

export default async function SuppliersPage() {
  await requireAdmin();

  const suppliers = await listSuppliers();
  const activeCount = suppliers.filter((s) => s.isActive).length;
  const inactiveCount = suppliers.filter((s) => !s.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/dashboard" className="hover:text-amber-600 transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">Suppliers</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Manage supplier master data for ingredient sourcing
          </p>
        </div>
        <Link
          href="/suppliers/new"
          className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 transition-colors flex-shrink-0"
        >
          + Add Supplier
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{suppliers.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-100 p-4">
          <p className="text-xs text-green-600">Active</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Inactive</p>
          <p className="text-2xl font-bold text-gray-500 mt-1">{inactiveCount}</p>
        </div>
      </div>

      {/* Table */}
      <SupplierTable suppliers={suppliers} />
    </div>
  );
}
