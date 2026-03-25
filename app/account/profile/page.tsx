import { requireAuth } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import ProfileForm from "./ProfileForm";
import Link from "next/link";

export default async function ProfilePage() {
  const session = await requireAuth();

  // Always fetch from DB using session userId — never trust URL params
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    return (
      <div className="text-center py-12 text-gray-500">사용자 정보를 불러올 수 없습니다.</div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link href="/account" className="hover:text-amber-600 transition-colors">
            내 계정
          </Link>
          <span>/</span>
          <span className="text-gray-700">프로필 수정</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">프로필 수정</h1>
        <p className="text-gray-500 mt-1">기본 프로필 정보를 수정하세요</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <ProfileForm currentName={user.name} currentEmail={user.email} />
      </div>
    </div>
  );
}
