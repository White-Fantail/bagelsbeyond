export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import {
  listFreshnessLogs,
  getLastQuantitiesByProductAndType,
} from "@/lib/services/freshnessService";
import { listMenuProducts } from "@/lib/services/menuProductService";
import { FreshnessLogType } from "@/app/generated/prisma/enums";
import FreshnessLogTable from "@/components/FreshnessLogTable";
import AddFreshnessLogDialog from "@/components/AddFreshnessLogDialog";
import {
  createFreshnessLogAction,
  updateFreshnessLogAction,
  deleteFreshnessLogAction,
} from "@/app/actions/freshness";

type SearchParams = {
  productId?: string;
  logType?: string;
  since?: string;
  until?: string;
};

export default async function FreshnessLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const logTypeFilter =
    sp.logType === FreshnessLogType.MADE
      ? FreshnessLogType.MADE
      : sp.logType === FreshnessLogType.DISPLAYED
      ? FreshnessLogType.DISPLAYED
      : sp.logType === FreshnessLogType.DISCARDED
      ? FreshnessLogType.DISCARDED
      : sp.logType === FreshnessLogType.SOLD
      ? FreshnessLogType.SOLD
      : undefined;

  const [logs, products, lastQuantities] = await Promise.all([
    listFreshnessLogs({
      productId: sp.productId || undefined,
      logType: logTypeFilter,
      since: sp.since ? new Date(sp.since) : undefined,
      until: sp.until ? new Date(sp.until) : undefined,
    }),
    listMenuProducts({ isActive: true }),
    getLastQuantitiesByProductAndType(),
  ]);

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
            <Link href="/freshness" className="hover:text-amber-600 transition-colors">
              Freshness
            </Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">Log History</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Freshness Log History</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            View the complete history of made, displayed, discarded, and sold logs.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <AddFreshnessLogDialog
            products={products}
            lastQuantities={lastQuantities}
            onSubmit={createFreshnessLogAction}
          />
        </div>
      </div>

      {/* Filters */}
      <FreshnessLogsFilter products={products} searchParams={sp} />

      {/* Result count */}
      <p className="text-sm text-gray-500">
        Total <strong className="text-gray-700">{logs.length}</strong>
      </p>

      <FreshnessLogTable
        logs={logs}
        products={products}
        lastQuantities={lastQuantities}
        onUpdate={updateFreshnessLogAction}
        onDelete={deleteFreshnessLogAction}
      />
    </div>
  );
}

function FreshnessLogsFilter({
  products,
  searchParams,
}: {
  products: Array<{ id: string; name: string }>;
  searchParams: SearchParams;
}) {
  return (
    <form method="GET" className="flex flex-wrap gap-3">
      {/* Product filter */}
      <select
        name="productId"
        defaultValue={searchParams.productId ?? ""}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
      >
        <option value="">All products</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {/* Log type filter */}
      <select
        name="logType"
        defaultValue={searchParams.logType ?? ""}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
      >
        <option value="">All types</option>
        <option value={FreshnessLogType.MADE}>Made</option>
        <option value={FreshnessLogType.DISPLAYED}>Displayed</option>
        <option value={FreshnessLogType.DISCARDED}>Discarded</option>
        <option value={FreshnessLogType.SOLD}>Sold</option>
      </select>

      {/* Date range */}
      <input
        type="date"
        name="since"
        defaultValue={searchParams.since ?? ""}
        placeholder="Start date"
        className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      <input
        type="date"
        name="until"
        defaultValue={searchParams.until ?? ""}
        placeholder="End date"
        className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
      />

      <button
        type="submit"
        className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
      >
        Apply Filters
      </button>
      {(searchParams.productId || searchParams.logType || searchParams.since || searchParams.until) && (
        <Link
          href="/freshness/logs"
          className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Reset
        </Link>
      )}
    </form>
  );
}
