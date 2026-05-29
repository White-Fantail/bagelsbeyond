export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { getSupplierById } from "@/lib/services/supplierService";
import {
  getScraperCredentialStatus,
  listScraperSyncLogs,
} from "@/lib/services/scraperSyncService";
import { listScraperAdapters, getScraperAdapter } from "@/lib/suppliers/scrapers/registry";
import Link from "next/link";
import { notFound } from "next/navigation";
import SupplierScraperClient from "./SupplierScraperClient";

export default async function SupplierScraperPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supplier = await getSupplierById(id);
  if (!supplier) notFound();

  const [credentialStatus, syncLogs] = await Promise.all([
    getScraperCredentialStatus(id),
    listScraperSyncLogs(id, 20),
  ]);

  const adapters = listScraperAdapters();

  // Build a map of adapterKey -> credentialFields for the client
  const adapterFields = Object.fromEntries(
    adapters.map((a) => {
      const adapter = getScraperAdapter(a.adapterKey);
      return [a.adapterKey, adapter?.credentialFields ?? []];
    })
  );

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
          <Link href={`/suppliers/${id}`} className="hover:text-amber-600 transition-colors">
            {supplier.name}
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Scraper Integration</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Scraper Integration</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          Configure browser-based scraping to fetch prices from{" "}
          {supplier.name}&apos;s website
        </p>
      </div>

      {/* Quick nav */}
      <div className="flex gap-2 text-sm flex-wrap">
        <Link
          href={`/suppliers/${id}`}
          className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          View Supplier
        </Link>
        <Link
          href={`/suppliers/${id}/edit`}
          className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Edit Supplier
        </Link>
        <Link
          href={`/suppliers/${id}/api`}
          className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          API Integration
        </Link>
      </div>

      {/* Info banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 space-y-1">
        <p className="font-medium">How scraper sync works</p>
        <ul className="list-disc list-inside space-y-0.5 text-amber-700">
          <li>
            Set an ingredient–supplier link&apos;s sync mode to{" "}
            <span className="font-medium">Scraper Ready</span> and add a
            product URL (or product code for search-based scraping).
          </li>
          <li>
            Click <span className="font-medium">Run Scraper Sync</span> to log
            in to the supplier website and fetch the latest prices.
          </li>
          <li>
            Prices are applied through the same pipeline as manual and CSV
            updates, with full price history recorded.
          </li>
        </ul>
      </div>

      <SupplierScraperClient
        supplier={supplier}
        credentialStatus={credentialStatus}
        adapters={adapters}
        adapterFields={adapterFields}
        syncLogs={syncLogs}
      />
    </div>
  );
}
