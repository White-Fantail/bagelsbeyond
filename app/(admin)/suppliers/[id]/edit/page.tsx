export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { getSupplierById } from "@/lib/services/supplierService";
import Link from "next/link";
import { notFound } from "next/navigation";
import SupplierForm from "../../SupplierForm";

export default async function EditSupplierPage({
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
          <Link href={`/suppliers/${id}`} className="hover:text-amber-600 transition-colors">
            {supplier.name}
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Edit</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Supplier</h1>
        <p className="text-gray-500 mt-0.5 text-sm">{supplier.name}</p>
      </div>

      <SupplierForm supplier={supplier} />
    </div>
  );
}
