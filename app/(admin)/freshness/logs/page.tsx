export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { listFreshnessLogs } from "@/lib/services/freshnessService";
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
      : undefined;

  const [logs, products] = await Promise.all([
    listFreshnessLogs({
      productId: sp.productId || undefined,
      logType: logTypeFilter,
      since: sp.since ? new Date(sp.since) : undefined,
      until: sp.until ? new Date(sp.until) : undefined,
    }),
    listMenuProducts({ isActive: true }),
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
              신선도 관리
            </Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">로그 이력</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">신선도 로그 이력</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            제조 및 디스플레이 로그 전체 이력입니다.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <AddFreshnessLogDialog
            products={products}
            onSubmit={createFreshnessLogAction}
          />
        </div>
      </div>

      {/* Filters */}
      <FreshnessLogsFilter products={products} searchParams={sp} />

      {/* Result count */}
      <p className="text-sm text-gray-500">
        총 <strong className="text-gray-700">{logs.length}</strong>건
      </p>

      <FreshnessLogTable
        logs={logs}
        products={products}
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
        <option value="">전체 제품</option>
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
        <option value="">전체 유형</option>
        <option value={FreshnessLogType.MADE}>제조</option>
        <option value={FreshnessLogType.DISPLAYED}>디스플레이 시작</option>
      </select>

      {/* Date range */}
      <input
        type="date"
        name="since"
        defaultValue={searchParams.since ?? ""}
        placeholder="시작일"
        className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      <input
        type="date"
        name="until"
        defaultValue={searchParams.until ?? ""}
        placeholder="종료일"
        className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
      />

      <button
        type="submit"
        className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
      >
        필터 적용
      </button>
      {(searchParams.productId || searchParams.logType || searchParams.since || searchParams.until) && (
        <Link
          href="/freshness/logs"
          className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          초기화
        </Link>
      )}
    </form>
  );
}
