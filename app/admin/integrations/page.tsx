export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import Link from "next/link";
import { isLoyverseEnabled, isLoyverseMockMode } from "@/lib/integrations/adapters/pos/loyverse";
import { prisma } from "@/lib/db";
import { IntegrationSource } from "@/app/generated/prisma/enums";

export default async function IntegrationsPage() {
  await requireAdmin();

  const loyverseMappedCount = await prisma.externalProductMap.count({
    where: { source: IntegrationSource.LOYVERSE },
  });
  const loyverseLastSync = await prisma.externalProductMap.findFirst({
    where: { source: IntegrationSource.LOYVERSE },
    orderBy: { lastSyncedAt: "desc" },
    select: { lastSyncedAt: true },
  });

  const loyverseEnabled = isLoyverseEnabled();
  const loyverseMock = isLoyverseMockMode();

  return (
    <div className="space-y-6">
      {/* Breadcrumb + header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/admin" className="hover:text-amber-600 transition-colors">
            Admin Dashboard
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Integrations</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">External POS Integration</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          Manage catalog synchronization with external POS systems.
        </p>
      </div>

      {/* Integration cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Loyverse card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Loyverse POS</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Sync menu catalog, products, and modifiers
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {loyverseEnabled ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                  Inactive
                </span>
              )}
              {loyverseMock && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  Mock mode
                </span>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Linked Products</dt>
            <dd className="font-medium text-gray-900 text-right">{loyverseMappedCount}</dd>
            <dt className="text-gray-500">Last Sync</dt>
            <dd className="font-medium text-gray-900 text-right">
              {loyverseLastSync?.lastSyncedAt
                ? loyverseLastSync.lastSyncedAt.toLocaleString("en-NZ")
                : "None"}
            </dd>
          </dl>

          <Link
            href="/admin/integrations/loyverse"
            className="block w-full text-center px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            Loyverse Settings & Sync →
          </Link>
        </div>

        {/* Placeholder for future POS */}
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-6 flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm font-medium text-gray-400">Coming soon</p>
          <p className="text-xs text-gray-400">Integrate with other POS systems (Square, Toast, etc.)</p>
        </div>
      </div>
    </div>
  );
}
