import { requireAuth } from "@/lib/auth/dal";
import AccountNav from "@/components/customer/account-nav";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return (
    <div className="space-y-4">
      <AccountNav />
      {children}
    </div>
  );
}
