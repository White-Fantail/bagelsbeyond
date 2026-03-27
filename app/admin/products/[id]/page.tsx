import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import Link from "next/link";
import ProductForm from "../ProductForm";
import DeleteProductButton from "./DeleteProductButton";
import OptionGroupManager from "./OptionGroupManager";
import { IntegrationSource } from "@/app/generated/prisma/enums";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;

  const optionGroupSelect = {
    id: true,
    name: true,
    minSelect: true,
    maxSelect: true,
    isRequired: true,
    sortOrder: true,
    externalMapping: {
      select: { externalOptionGroupId: true },
    },
    options: {
      orderBy: { sortOrder: "asc" as const },
      select: {
        id: true,
        name: true,
        priceDelta: true,
        isActive: true,
        sortOrder: true,
        sku: true,
        tracksInventory: true,
        externalOptionMappings: {
          where: { source: IntegrationSource.LOYVERSE },
          select: {
            id: true,
            externalOptionId: true,
            externalName: true,
          },
        },
      },
    },
  } as const;

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      category: true,
      basePrice: true,
      isActive: true,
      isSubscriptionEligible: true,
      sortOrder: true,
      externalMappings: {
        where: { source: IntegrationSource.LOYVERSE },
        select: { id: true, externalProductId: true },
      },
      // Direct (primary) option groups
      optionGroups: {
        orderBy: { sortOrder: "asc" },
        select: optionGroupSelect,
      },
      // Groups assigned via ProductOptionGroupAssignment
      optionGroupAssignments: {
        select: {
          optionGroup: { select: optionGroupSelect },
        },
      },
    },
  });

  if (!product) {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/admin" className="hover:text-amber-600 transition-colors">
              관리자 대시보드
            </Link>
            <span>/</span>
            <Link href="/admin/products" className="hover:text-amber-600 transition-colors">
              상품 관리
            </Link>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-lg font-medium text-gray-700">상품을 찾을 수 없습니다</p>
          <p className="text-sm text-gray-400 mt-1">삭제되었거나 존재하지 않는 상품입니다</p>
          <Link
            href="/admin/products"
            className="mt-4 inline-block px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            상품 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const { optionGroups, optionGroupAssignments, externalMappings, ...productFields } = product;

  const isLoyverseSynced = externalMappings.length > 0;
  const externalProductId = externalMappings[0]?.externalProductId ?? null;

  const formProduct = {
    ...productFields,
    description: productFields.description ?? undefined,
    isLoyverseSynced,
    externalProductId,
  };

  // Combine direct groups and assignment groups, deduplicate by id
  const assignmentGroups = optionGroupAssignments.map((a) => a.optionGroup);
  const directGroupIds = new Set(optionGroups.map((g) => g.id));
  const allGroups = [
    ...optionGroups,
    ...assignmentGroups.filter((g) => !directGroupIds.has(g.id)),
  ].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ko"));

  // Count modifier mapping status
  const allOptions = allGroups.flatMap((g) => g.options);
  const mappedCount = allOptions.filter((o) => o.externalOptionMappings.length > 0).length;
  const unmappedActiveCount = allOptions.filter(
    (o) => o.isActive && o.externalOptionMappings.length === 0
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/admin" className="hover:text-amber-600 transition-colors">
              관리자 대시보드
            </Link>
            <span>/</span>
            <Link href="/admin/products" className="hover:text-amber-600 transition-colors">
              상품 관리
            </Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">{product.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">상품 수정</h1>
          <p className="text-gray-500 mt-0.5 text-sm">상품 정보를 수정합니다</p>
        </div>
        <DeleteProductButton productId={product.id} productName={product.name} />
      </div>

      <ProductForm product={formProduct} mode="edit" />

      <OptionGroupManager productId={product.id} initialGroups={allGroups} />

      {/* Modifier Mapping Status */}
      {allOptions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Loyverse Modifier 매핑 상태</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                베이글 종류(Bagel Type)는 variant가 아닌 modifier 기준으로 관리됩니다.
                주문 전송 전에 모든 옵션이 매핑되어 있어야 합니다.
              </p>
            </div>
            <Link
              href="/admin/integrations/loyverse/modifiers"
              className="shrink-0 px-3 py-1.5 rounded-lg text-sm bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            >
              매핑 관리 →
            </Link>
          </div>

          <div className="flex gap-4 text-sm">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
              ✓ 매핑됨 {mappedCount}개
            </span>
            {unmappedActiveCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                ✗ 미매핑 (활성) {unmappedActiveCount}개
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                미매핑 없음
              </span>
            )}
          </div>

          {allGroups.map((group) => (
            <div key={group.id} className="rounded-lg border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-100 px-4 py-2 text-xs font-semibold text-gray-600">
                {group.name}
                {group.isRequired && (
                  <span className="ml-2 text-amber-600">* 필수</span>
                )}
              </div>
              <ul className="divide-y divide-gray-100">
                {group.options.map((opt) => {
                  const mapping = opt.externalOptionMappings[0];
                  return (
                    <li key={opt.id} className="flex items-center justify-between px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={opt.isActive ? "text-gray-800" : "text-gray-400 line-through"}>
                          {opt.name}
                        </span>
                        {opt.tracksInventory && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                            재고추적
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {mapping ? (
                          <>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                              ✓ 매핑됨
                            </span>
                            <span className="text-xs text-gray-400 font-mono">
                              {mapping.externalName ?? mapping.externalOptionId}
                            </span>
                          </>
                        ) : opt.isActive ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                            ✗ 미매핑
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                            비활성
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
