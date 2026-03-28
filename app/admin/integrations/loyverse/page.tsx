export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import Link from "next/link";
import { isLoyverseEnabled, isLoyverseMockMode } from "@/lib/integrations/adapters/pos/loyverse";
import { prisma } from "@/lib/db";
import { IntegrationSource } from "@/app/generated/prisma/enums";
import LoyverseSyncButton from "./LoyverseSyncButton";

export default async function LoyverseIntegrationPage() {
  await requireAdmin();

  const hasToken = Boolean(process.env.LOYVERSE_API_TOKEN);
  const mockMode = isLoyverseMockMode();
  const enabled = isLoyverseEnabled();
  const baseUrl =
    process.env.LOYVERSE_API_BASE_URL ?? "https://api.loyverse.com/v1.0";

  const [mappedCount, lastFullSync, categoryCount] = await Promise.all([
    prisma.externalProductMap.count({
      where: { source: IntegrationSource.LOYVERSE },
    }),
    prisma.loyverseFullSyncLog.findFirst({
      orderBy: { syncedAt: "desc" },
      select: {
        syncedAt: true,
        status: true,
        categoriesUpserted: true,
        productsCreated: true,
        productsUpdated: true,
        modifierGroupsUpserted: true,
        modifierOptionsUpserted: true,
        modifierLinksUpdated: true,
        itemModifierLinksAttempted: true,
        itemModifierLinksPersisted: true,
        errorMessage: true,
      },
    }),
    prisma.loyverseCategory.count({ where: { isActive: true } }),
  ]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb + header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/admin" className="hover:text-amber-600 transition-colors">
            Admin Dashboard
          </Link>
          <span>/</span>
          <Link href="/admin/integrations" className="hover:text-amber-600 transition-colors">
            Integrations
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Loyverse</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Loyverse POS Integration</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          Sync Loyverse catalog (Categories, Modifiers, Products) all at once
        </p>
      </div>

      {/* Config status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Integration Settings Status</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <dt className="text-gray-500">POS Provider</dt>
            <dd className="font-medium text-gray-900">
              {process.env.POS_PROVIDER ?? "(not configured)"}
            </dd>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <dt className="text-gray-500">API token</dt>
            <dd>
              {hasToken ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  ✓ Configured
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                  ✗ Not configured (LOYVERSE_API_TOKEN)
                </span>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <dt className="text-gray-500">operation mode</dt>
            <dd>
              {mockMode ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  Mock mode (dev/test)
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  Live API Integration
                </span>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <dt className="text-gray-500">Active </dt>
            <dd>
              {enabled ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                  Inactive
                </span>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <dt className="text-gray-500">API Base URL</dt>
            <dd className="font-mono text-xs text-gray-700 truncate max-w-[200px]">{baseUrl}</dd>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <dt className="text-gray-500">Linked Products</dt>
            <dd className="font-medium text-gray-900">{mappedCount}</dd>
          </div>
          <div className="flex items-center justify-between pb-2">
            <dt className="text-gray-500">Synced Categories</dt>
            <dd className="font-medium text-gray-900">{categoryCount}</dd>
          </div>
        </dl>

        {!hasToken && !mockMode && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <strong>⚠ No API token configured.</strong> Operating in Mock mode.
            <br />
            Set the <code className="font-mono text-xs">LOYVERSE_API_TOKEN</code> environment variable for live integration.
          </div>
        )}
      </div>

      {/* Full sync control */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">Loyverse All Sync</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Syncs categories → modifier groups/options → products → links all at once.
            {mockMode && " (Mock Data in use)"}
          </p>
        </div>

        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
          <p className="font-medium text-gray-700">Sync Order</p>
          <ol className="space-y-0.5 list-decimal list-inside">
            <li>Fetch Loyverse Categories → upsert to local DB</li>
            <li>Fetch Loyverse Modifier groups/options → upsert to local DB</li>
            <li>Fetch Loyverse Products → upsert to local DB + link Categories + link Modifiers</li>
            <li>Clean up Products-Modifiers links removed from Loyverse</li>
          </ol>
        </div>

        {/* Last full sync status */}
        {lastFullSync && (
          <div
            className={`rounded-lg border p-3 text-xs space-y-1.5 ${
              lastFullSync.status === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : lastFullSync.status === "partial"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            <p className="font-semibold">
              {lastFullSync.status === "success"
                ? "✓ Last Full Sync successful"
                : lastFullSync.status === "partial"
                ? "⚠ Last Full Sync partially complete"
                : "✗ Last Full Sync Failed"}
            </p>
            <p>{lastFullSync.syncedAt.toLocaleString("en-NZ")}</p>
            {lastFullSync.status !== "failed" && (
              <div className="grid grid-cols-3 gap-1 text-xs">
                <span>Categories {lastFullSync.categoriesUpserted}</span>
                <span>New products {lastFullSync.productsCreated}</span>
                <span>Updated products {lastFullSync.productsUpdated}</span>
                <span>Modifier groups {lastFullSync.modifierGroupsUpserted}</span>
                <span>Modifier options {lastFullSync.modifierOptionsUpserted}</span>
                <span>Product-Modifier links {lastFullSync.modifierLinksUpdated}</span>
              </div>
            )}
            {lastFullSync.errorMessage && (
              <p className="text-red-600 font-mono break-all">{lastFullSync.errorMessage}</p>
            )}
          </div>
        )}

        <LoyverseSyncButton />
      </div>

      {/* Modifier mapping guide and links removed */}

      {/* Env docs link */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-2">
        <h2 className="font-semibold text-gray-900">Environment Variable Configuration Guide</h2>
        <p className="text-sm text-gray-500">
          Set the following variables in your <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">.env</code> file or deployment environment.
        </p>
        <pre className="text-xs bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto">
{`# Loyverse POS Integration
POS_PROVIDER=LOYVERSE
LOYVERSE_API_TOKEN=your-token-here
LOYVERSE_API_BASE_URL=https://api.loyverse.com/v1.0

# In development environment (uses Mock Data without a real API):
# LOYVERSE_MOCK=true`}
        </pre>
        <p className="text-xs text-gray-400">
          ⚠ Never commit actual tokens to source code or a repository.
        </p>
      </div>
    </div>
  );
}

