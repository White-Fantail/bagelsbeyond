export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

/**
 * Home page routing policy:
 * - Unauthenticated users see the Bagel's Beyond landing page.
 * - Authenticated ADMIN/STAFF are redirected to /dashboard.
 * - Authenticated CUSTOMER is redirected to /account.
 */
export default async function HomePage() {
  const session = await getSession();

  if (session) {
    if (session.role === "ADMIN" || session.role === "STAFF") {
      redirect("/dashboard");
    } else {
      // CUSTOMER
      redirect("/account");
    }
  }

  // Not logged in → show landing page
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16 sm:py-24">
        <div className="mb-4 text-6xl">🥯</div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
          Bagel&apos;s Beyond
        </h1>
        <p className="mt-4 text-lg sm:text-xl text-gray-500 max-w-xl">
          From sales records to predictions and production recommendations — manage your bagel shop smartly
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors shadow-sm"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="px-6 py-3 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
          >
            Sign Up
          </Link>
        </div>
      </section>

      {/* Feature cards */}
      <section className="max-w-4xl mx-auto px-4 pb-16 w-full">
        <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Key Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-amber-300 hover:shadow-sm transition-all"
            >
              <div className="text-3xl mb-3">{f.emoji}</div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">{f.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-gray-200 bg-white py-8 text-center">
        <p className="text-sm text-gray-500 mb-3">Already have an account?</p>
        <Link
          href="/login"
          className="text-sm font-medium text-amber-600 hover:text-amber-700 underline underline-offset-2"
        >
          Go to Login →
        </Link>
      </section>
    </div>
  );
}

const FEATURES = [
  {
    emoji: "📋",
    title: "Daily Sales Records",
    description: "Easily record daily store, Uber Eats, DoorDash, and other channel sales and production.",
  },
  {
    emoji: "🌤️",
    title: "Automatic External Data Collection",
    description: "Automatically collects Weather, Holiday, School Holiday, Local Event, and News data for analytics.",
  },
  {
    emoji: "🔮",
    title: "Sales Predictions",
    description: "Preview tomorrow's sales with a rule-based prediction engine using historical data and external factor weights.",
  },
  {
    emoji: "🥯",
    title: "Production Recommendation",
    description: "Recommends the optimal baking quantity based on predicted sold qty and historical sell-through rate.",
  },
  {
    emoji: "📊",
    title: "Analytics Report",
    description: "Identify patterns with daily/weekly/monthly/day-of-week analytics and Holiday/Weather segment comparisons.",
  },
  {
    emoji: "📅",
    title: "Calendar Visualization",
    description: "View actual sales and predictions in Calendar view, and check external factors with weather icons.",
  },
];
