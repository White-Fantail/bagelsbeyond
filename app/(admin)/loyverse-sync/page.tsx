export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { listLoyverseSyncLogs } from "@/lib/services/loyverseProductSyncService";
import LoyverseSyncManager from "./LoyverseSyncManager";

async function getInitialLogs() {
  const rows = await listLoyverseSyncLogs(30);
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    categoriesAdded: row.categoriesAdded,
    categoriesUpdated: row.categoriesUpdated,
    productsAdded: row.productsAdded,
    productsUpdated: row.productsUpdated,
    modifiersAdded: row.modifiersAdded,
    modifiersUpdated: row.modifiersUpdated,
    errorMessage: row.errorMessage,
    userName: row.triggeredByUser?.name ?? row.triggeredByUser?.email ?? null,
  }));
}

export default async function LoyverseSyncPage() {
  await requireAdmin();
  const logs = await getInitialLogs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Loyverse Sync</h1>
        <p className="text-gray-500 mt-1">
          Match unmatched Loyverse items with existing products, then sync catalog updates.
        </p>
      </div>

      <LoyverseSyncManager initialLogs={logs} />
    </div>
  );
}
