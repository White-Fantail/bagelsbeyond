import { getSession } from "@/lib/auth/session";
import CustomerLayoutInner from "@/components/customer/customer-layout-inner";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <CustomerLayoutInner
      session={session ? { name: session.name, userId: session.userId } : null}
    >
      {children}
    </CustomerLayoutInner>
  );
}
