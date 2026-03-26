export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { IntegrationSource } from "@/app/generated/prisma/enums";
import ModifierMappingManager from "./ModifierMappingManager";

export default async function LoyverseModifierMappingPage() {
  await requireAdmin();

  // Load all option groups with their options, including mapping status
  const optionGroups = await prisma.productOptionGroup.findMany({
    orderBy: { name: "asc" },
    include: {
      product: { select: { id: true, name: true } },
      options: {
        orderBy: { sortOrder: "asc" },
        include: {
          externalOptionMappings: {
            where: { source: IntegrationSource.LOYVERSE },
            select: {
              id: true,
              externalOptionId: true,
              externalName: true,
              externalGroupId: true,
              externalGroupName: true,
              lastSyncedAt: true,
            },
          },
        },
      },
    },
  });

  const mappedCount = optionGroups
    .flatMap((g) => g.options)
    .filter((o) => o.externalOptionMappings.length > 0).length;

  const unmappedCount = optionGroups
    .flatMap((g) => g.options)
    .filter((o) => o.isActive && o.externalOptionMappings.length === 0).length;

  // Serialize Date fields for client component (Date → string)
  const serializedGroups = optionGroups.map((g) => ({
    ...g,
    options: g.options.map((o) => ({
      ...o,
      externalOptionMappings: o.externalOptionMappings.map((m) => ({
        ...m,
        lastSyncedAt: m.lastSyncedAt?.toISOString() ?? null,
      })),
    })),
  }));

  return (
    <div className="space-y-6">
      {/* Breadcrumb + header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/admin" className="hover:text-amber-600 transition-colors">
            관리자 대시보드
          </Link>
          <span>/</span>
          <Link href="/admin/integrations" className="hover:text-amber-600 transition-colors">
            외부 연동
          </Link>
          <span>/</span>
          <Link
            href="/admin/integrations/loyverse"
            className="hover:text-amber-600 transition-colors"
          >
            Loyverse
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Modifier 매핑</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Loyverse Modifier 매핑</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          내부 옵션(Modifier)과 Loyverse modifier option을 연결합니다.
          매핑이 없는 옵션은 Loyverse로 전송되지 않습니다.
        </p>
      </div>

      {/* Policy notice */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">⚙ Bagel choice는 Modifier 기준으로 관리됩니다</p>
        <ul className="list-disc list-inside space-y-0.5 text-amber-700">
          <li>
            Plain / Sesame / Blueberry / Everything 등 베이글 종류는{" "}
            <strong>variant가 아닌 modifier</strong>로 관리합니다.
          </li>
          <li>
            하나의 modifier 그룹(Bagel Type)을 여러 상품(Bagel, Sandwich 등)에 공통 연결할 수
            있습니다.
          </li>
          <li>
            상품(Product)이 Loyverse에 매핑되어 있어도,{" "}
            <strong>modifier가 매핑되지 않으면 주문 전송이 차단</strong>됩니다.
          </li>
          <li>
            자세한 내용은{" "}
            <a
              href="https://github.com/White-Fantial/Beyond/blob/main/docs/bagel-modifier-policy.md"
              className="underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              docs/bagel-modifier-policy.md
            </a>{" "}
            를 참고하세요.
          </li>
        </ul>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">
            {optionGroups.flatMap((g) => g.options).length}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">전체 옵션</p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{mappedCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">매핑 완료</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{unmappedCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">미매핑 (활성)</p>
        </div>
      </div>

      {/* Interactive mapping manager (client component) */}
      <ModifierMappingManager initialGroups={serializedGroups} />
    </div>
  );
}
