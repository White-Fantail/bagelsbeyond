export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    if (session.role === "ADMIN" || session.role === "STAFF") redirect("/dashboard");
    redirect("/account");
  }

  return (
    <main className="min-h-screen bg-stone-950 text-white flex items-center justify-center px-6">
      <div className="max-w-xl text-center space-y-6">
        <p className="text-amber-300 text-sm font-semibold tracking-widest uppercase">Bagels Beyond</p>
        <h1 className="text-5xl font-extrabold tracking-tight">Operations Portal</h1>
        <p className="text-stone-300">Internal management for freshness, products and retained sales records.</p>
        <Link href="/login" className="inline-block px-8 py-3 rounded-full bg-amber-400 text-stone-950 font-bold hover:bg-amber-300 transition-colors">Staff Login</Link>
      </div>
    </main>
  );
}
