import { requireAuth } from "@/lib/auth/dal";

export default async function AccountPage() {
  const session = await requireAuth();

  const roleLabel: Record<string, string> = {
    ADMIN: "관리자",
    STAFF: "스태프",
    CUSTOMER: "고객",
  };

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">내 계정</h1>
        <p className="text-gray-500 mt-1">계정 정보를 확인하세요</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-2xl font-bold text-amber-700">
            {session.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{session.name}</p>
            <p className="text-sm text-gray-500">{session.email}</p>
          </div>
        </div>

        <hr className="border-gray-100" />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">권한</p>
            <p className="font-medium text-gray-900 mt-0.5">
              {roleLabel[session.role] ?? session.role}
            </p>
          </div>
          <div>
            <p className="text-gray-500">상태</p>
            <p className="font-medium text-green-600 mt-0.5">활성</p>
          </div>
        </div>
      </div>
    </div>
  );
}
