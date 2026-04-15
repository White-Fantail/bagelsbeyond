export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import Link from "next/link";
import SupplierForm from "../SupplierForm";

export default async function NewSupplierPage() {
  await requireAdmin();

  return (
    <div className="space-y-6 max-w-2xl">
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
          <span className="text-gray-700 font-medium">New</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Add Supplier</h1>
        <p className="text-gray-500 mt-0.5 text-sm">Create a new supplier record</p>
      </div>

      <SupplierForm />
    </div>
  );
}
