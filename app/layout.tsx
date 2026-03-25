import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "베이글스 비욘드 매출 관리",
  description: "베이글스 비욘드 매출 관리 대장",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const navSession = session
    ? { name: session.name, role: session.role }
    : null;

  return (
    <html lang="ko">
      <body className="font-sans antialiased">
        <div className="min-h-screen bg-gray-50">
          <Navigation session={navSession} />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
