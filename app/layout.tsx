import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Sidebar from "@/components/navigation/Sidebar";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Bagels Beyond Sales Management",
  description: "Bagels Beyond Sales Management",
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
          {/* Fixed left sidebar — desktop only */}
          <Sidebar session={navSession} />

          {/* Fixed top bar + mobile drawer */}
          <Navigation session={navSession} />

          {/* Main content — offset for sidebar (lg) and top bar */}
          <div className="lg:pl-64 pt-16">
            <main className="p-4 sm:p-6 lg:p-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
