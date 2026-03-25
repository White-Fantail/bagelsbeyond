import { requireAuth } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function AccountPage() {
  const session = await requireAuth();

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!user) {
    return (
      <div className="text-center py-12 text-gray-500">사용자 정보를 불러올 수 없습니다.</div>
    );
  }

  const roleLabel: Record<string, string> = {
    ADMIN: "관리자",
    STAFF: "스태프",
    CUSTOMER: "고객",
  };

  const joinedAt = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(user.createdAt));

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">내 계정</h1>
        <p className="text-gray-500 mt-1">계정 정보 및 설정을 관리하세요</p>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-2xl font-bold text-amber-700">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user.name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>

        <hr className="border-gray-100" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">권한</p>
            <p className="font-medium text-gray-900 mt-0.5">
              {roleLabel[user.role] ?? user.role}
            </p>
          </div>
          <div>
            <p className="text-gray-500">상태</p>
            <p className={`font-medium mt-0.5 ${user.isActive ? "text-green-600" : "text-red-500"}`}>
              {user.isActive ? "활성" : "비활성"}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-gray-500">가입일</p>
            <p className="font-medium text-gray-900 mt-0.5">{joinedAt}</p>
          </div>
        </div>

        <hr className="border-gray-100" />

        <div className="flex flex-wrap gap-2">
          <Link
            href="/account/profile"
            className="text-sm px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors font-medium"
          >
            프로필 수정
          </Link>
          <Link
            href="/account/security"
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors font-medium"
          >
            비밀번호 변경
          </Link>
        </div>
      </div>

      {/* Future feature sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Orders */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">📦</span>
            <h2 className="font-semibold text-gray-900">내 주문</h2>
          </div>
          <p className="text-sm text-gray-500">주문 내역 및 상태를 확인할 수 있습니다.</p>
          <p className="mt-3 text-xs text-amber-600 font-medium">곧 연결될 예정</p>
        </div>

        {/* Subscriptions */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🔄</span>
            <h2 className="font-semibold text-gray-900">내 구독</h2>
          </div>
          <p className="text-sm text-gray-500">정기 구독 및 플랜을 관리할 수 있습니다.</p>
          <p className="mt-3 text-xs text-amber-600 font-medium">곧 연결될 예정</p>
        </div>

        {/* Pickup / Contact */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">📍</span>
            <h2 className="font-semibold text-gray-900">픽업 정보</h2>
          </div>
          <p className="text-sm text-gray-500">저장된 픽업 메모 및 연락 정보를 관리합니다.</p>
          <p className="mt-3 text-xs text-amber-600 font-medium">곧 연결될 예정</p>
        </div>

        {/* Payment */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">💳</span>
            <h2 className="font-semibold text-gray-900">결제 수단</h2>
          </div>
          <p className="text-sm text-gray-500">등록된 결제 수단을 확인하고 관리합니다.</p>
          <p className="mt-3 text-xs text-amber-600 font-medium">곧 연결될 예정</p>
        </div>
      </div>
    </div>
  );
}
