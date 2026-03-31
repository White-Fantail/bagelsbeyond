import Navigation from "@/components/Navigation";
import Sidebar from "@/components/navigation/Sidebar";
import { getSession } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const navSession = session ? { name: session.name, role: session.role } : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar session={navSession} />
      <Navigation session={navSession} />
      <div className="lg:pl-64 pt-16">
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
