import { requireAuth } from "@/lib/auth/dal";
import PasswordForm from "./PasswordForm";
import Link from "next/link";

export default async function SecurityPage() {
  await requireAuth();

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link href="/account" className="hover:text-amber-600 transition-colors">
            내 계정
          </Link>
          <span>/</span>
          <span className="text-gray-700">비밀번호 변경</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">비밀번호 변경</h1>
        <p className="text-gray-500 mt-1">계정 보안을 위해 주기적으로 비밀번호를 변경하세요</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <PasswordForm />
      </div>
    </div>
  );
}
