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
            관리자 대시보드
          </Link>
          <span>/</span>
          <Link href="/admin/integrations" className="hover:text-amber-600 transition-colors">
            외부 연동
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Loyverse</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Loyverse POS 연동</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          Loyverse 카탈로그(카테고리·모디파이어·상품)를 한 번에 동기화합니다
        </p>
      </div>

      {/* Config status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">연동 설정 상태</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <dt className="text-gray-500">POS Provider</dt>
            <dd className="font-medium text-gray-900">
              {process.env.POS_PROVIDER ?? "(미설정)"}
            </dd>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <dt className="text-gray-500">API 토큰</dt>
            <dd>
              {hasToken ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  ✓ 설정됨
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                  ✗ 미설정 (LOYVERSE_API_TOKEN)
                </span>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <dt className="text-gray-500">동작 모드</dt>
            <dd>
              {mockMode ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  Mock 모드 (개발/테스트)
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  실제 API 연동
                </span>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <dt className="text-gray-500">활성 여부</dt>
            <dd>
              {enabled ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  활성
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                  비활성
                </span>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <dt className="text-gray-500">API Base URL</dt>
            <dd className="font-mono text-xs text-gray-700 truncate max-w-[200px]">{baseUrl}</dd>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <dt className="text-gray-500">연동된 상품 수</dt>
            <dd className="font-medium text-gray-900">{mappedCount}개</dd>
          </div>
          <div className="flex items-center justify-between pb-2">
            <dt className="text-gray-500">동기화된 카테고리 수</dt>
            <dd className="font-medium text-gray-900">{categoryCount}개</dd>
          </div>
        </dl>

        {!hasToken && !mockMode && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <strong>⚠ API 토큰이 없습니다.</strong> Mock 모드로 동작합니다.
            <br />
            실제 연동을 위해 <code className="font-mono text-xs">LOYVERSE_API_TOKEN</code> 환경변수를 설정하세요.
          </div>
        )}
      </div>

      {/* Full sync control */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">Loyverse 전체 동기화</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            카테고리 → 모디파이어 그룹/옵션 → 상품 → 연결 관계를 한 번에 동기화합니다.
            {mockMode && " (현재 Mock 데이터 사용)"}
          </p>
        </div>

        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
          <p className="font-medium text-gray-700">동기화 순서</p>
          <ol className="space-y-0.5 list-decimal list-inside">
            <li>Loyverse 카테고리 조회 → 로컬 DB upsert</li>
            <li>Loyverse 모디파이어 그룹/옵션 조회 → 로컬 DB upsert</li>
            <li>Loyverse 상품 조회 → 로컬 DB upsert + 카테고리 연결 + 모디파이어 연결</li>
            <li>Loyverse에서 제거된 상품-모디파이어 연결 정리</li>
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
                ? "✓ 마지막 전체 동기화 성공"
                : lastFullSync.status === "partial"
                ? "⚠ 마지막 전체 동기화 부분 완료"
                : "✗ 마지막 전체 동기화 실패"}
            </p>
            <p>{lastFullSync.syncedAt.toLocaleString("ko-KR")}</p>
            {lastFullSync.status !== "failed" && (
              <div className="grid grid-cols-3 gap-1 text-xs">
                <span>카테고리 {lastFullSync.categoriesUpserted}개</span>
                <span>신규상품 {lastFullSync.productsCreated}개</span>
                <span>업데이트상품 {lastFullSync.productsUpdated}개</span>
                <span>모디파이어그룹 {lastFullSync.modifierGroupsUpserted}개</span>
                <span>모디파이어옵션 {lastFullSync.modifierOptionsUpserted}개</span>
                <span>상품-모디파이어링크 {lastFullSync.modifierLinksUpdated}개</span>
              </div>
            )}
            {lastFullSync.errorMessage && (
              <p className="text-red-600 font-mono break-all">{lastFullSync.errorMessage}</p>
            )}
          </div>
        )}

        <LoyverseSyncButton />
      </div>

      {/* Modifier 매핑 안내 및 링크 제거됨 */}

      {/* Env docs link */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-2">
        <h2 className="font-semibold text-gray-900">환경변수 설정 가이드</h2>
        <p className="text-sm text-gray-500">
          <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">.env</code> 파일 또는 배포 환경에 아래 변수를 설정하세요.
        </p>
        <pre className="text-xs bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto">
{`# Loyverse POS 연동
POS_PROVIDER=LOYVERSE
LOYVERSE_API_TOKEN=your-token-here
LOYVERSE_API_BASE_URL=https://api.loyverse.com/v1.0

# 개발 환경에서 실제 API 없이 Mock 데이터 사용:
# LOYVERSE_MOCK=true`}
        </pre>
        <p className="text-xs text-gray-400">
          ⚠ 실제 토큰은 절대 소스 코드나 저장소에 커밋하지 마세요.
        </p>
      </div>
    </div>
  );
}

