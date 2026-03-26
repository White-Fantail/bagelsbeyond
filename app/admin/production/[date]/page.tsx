export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import Link from "next/link";
import { getProductionRecommendation } from "@/lib/services/production-recommendation";
import ProductionRecommendationView from "./ProductionRecommendationView";

interface Props {
  params: Promise<{ date: string }>;
}

export default async function ProductionDatePage({ params }: Props) {
  await requireAdmin();
  const { date } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return (
      <div className="text-red-500 p-6">
        잘못된 날짜 형식입니다. YYYY-MM-DD 형식을 사용해주세요.
      </div>
    );
  }

  const recommendation = await getProductionRecommendation(new Date(date + "T00:00:00.000Z"));

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/admin" className="hover:text-amber-600 transition-colors">
            관리자 대시보드
          </Link>
          <span>/</span>
          <Link href="/admin/production" className="hover:text-amber-600 transition-colors">
            생산량 추천
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">{date}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">생산량 추천 — {date}</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          확정 주문·구독·예측 수요·기존 재고를 종합한 생산 추천 결과입니다
        </p>
      </div>
      <ProductionRecommendationView recommendation={recommendation} date={date} />
    </div>
  );
}
