export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { getSupplierById } from "@/lib/services/supplierService";
import {
  getCredentialStatus,
  listSyncLogs,
} from "@/lib/services/supplierSyncService";
import { listAdapters } from "@/lib/suppliers/registry";
import Link from "next/link";
import { notFound } from "next/navigation";
import SupplierApiClient from "./SupplierApiClient";

export default async function SupplierApiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supplier = await getSupplierById(id);
  if (!supplier) notFound();

  const [credentialStatus, syncLogs, adapters] = await Promise.all([
    getCredentialStatus(id),
    listSyncLogs(id, 20),
    Promise.resolve(listAdapters()),
  ]);

  return (
    <div className="space-y-6 max-w-4xl">
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
          <Link
            href={`/suppliers/${id}/edit`}
            className="hover:text-amber-600 transition-colors"
          >
            {supplier.name}
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">API Integration</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">API Integration</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          Connect {supplier.name} to an API adapter for automatic price syncing
        </p>
      </div>

      {/* Quick nav */}
      <div className="flex gap-2 text-sm">
        <Link
          href={`/suppliers/${id}/edit`}
          className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Edit Supplier
        </Link>
      </div>

      <SupplierApiClient
        supplier={supplier}
        credentialStatus={credentialStatus}
        adapters={adapters}
        syncLogs={syncLogs}
      />
    </div>
  );
}
