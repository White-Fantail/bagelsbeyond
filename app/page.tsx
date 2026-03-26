export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

/**
 * Home page routing policy (B안):
 * - Unauthenticated users see the Bagel's Beyond landing page.
 * - Authenticated ADMIN/STAFF are redirected to /dashboard.
 * - Authenticated CUSTOMER is redirected to /account.
 */
export default async function HomePage() {
  const session = await getSession();

  if (session) {
    if (session.role === "ADMIN" || session.role === "STAFF") {
      redirect("/dashboard");
    } else {
      // CUSTOMER
      redirect("/account");
    }
  }

  // Not logged in → show landing page
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16 sm:py-24">
        <div className="mb-4 text-6xl">🥯</div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
          Bagel&apos;s Beyond
        </h1>
        <p className="mt-4 text-lg sm:text-xl text-gray-500 max-w-xl">
          매출 기록부터 예측, 생산량 추천까지 — 베이글 매장 운영을 스마트하게
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors shadow-sm"
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="px-6 py-3 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
          >
            회원가입
          </Link>
        </div>
      </section>

      {/* Feature cards */}
      <section className="max-w-4xl mx-auto px-4 pb-16 w-full">
        <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">주요 기능</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-amber-300 hover:shadow-sm transition-all"
            >
              <div className="text-3xl mb-3">{f.emoji}</div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">{f.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-gray-200 bg-white py-8 text-center">
        <p className="text-sm text-gray-500 mb-3">이미 계정이 있으신가요?</p>
        <Link
          href="/login"
          className="text-sm font-medium text-amber-600 hover:text-amber-700 underline underline-offset-2"
        >
          로그인하러 가기 →
        </Link>
      </section>
    </div>
  );
}

const FEATURES = [
  {
    emoji: "📋",
    title: "일별 매출 기록",
    description: "매장, Uber Eats, DoorDash, 기타 채널별 매출과 생산량을 날짜별로 간편하게 기록하세요.",
  },
  {
    emoji: "🌤️",
    title: "외부 데이터 자동 수집",
    description: "날씨, 공휴일, 학교 방학, 지역 이벤트, 뉴스 데이터를 자동으로 수집해 분석에 반영합니다.",
  },
  {
    emoji: "🔮",
    title: "매출 예측",
    description: "과거 데이터와 외부 요인 가중치를 활용한 규칙 기반 예측 엔진으로 내일 매출을 미리 알아보세요.",
  },
  {
    emoji: "🥯",
    title: "생산량 추천",
    description: "예측 판매량과 과거 소진율을 기반으로 최적의 베이글 생산량을 추천해드립니다.",
  },
  {
    emoji: "📊",
    title: "분석 리포트",
    description: "일별·주별·월별·요일별 분석과 공휴일·날씨 세그먼트 비교로 패턴을 파악하세요.",
  },
  {
    emoji: "📅",
    title: "달력 시각화",
    description: "실제 매출과 예측을 달력 형태로 한눈에 보고, 날씨 아이콘으로 외부 요인도 확인하세요.",
  },
];
