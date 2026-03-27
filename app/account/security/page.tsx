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
            My Account
          </Link>
          <span>/</span>
          <span className="text-gray-700">Change Password</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Change Password</h1>
        <p className="text-gray-500 mt-1">Change your password regularly to keep your account secure</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <PasswordForm />
      </div>
    </div>
  );
}
