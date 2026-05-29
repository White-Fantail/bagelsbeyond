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
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-amber-950 text-white">
        {/* warm gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900 via-amber-950 to-stone-950 opacity-90" />
        {/* decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-amber-700 opacity-20 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-orange-600 opacity-20 blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-6 py-24 sm:py-36 text-center">
          <p className="text-amber-300 text-sm font-semibold tracking-widest uppercase mb-4">
            Handcrafted · Fresh Daily · Made to Order
          </p>
          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-none mb-6">
            Bagels Beyond
          </h1>
          <p className="text-amber-100/80 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Every bagel is hand-rolled and baked fresh each morning.
            Your sandwich is made the moment you order it — never sitting, never waiting.
          </p>
          <Link
            href="/order"
            className="inline-block px-10 py-4 rounded-full bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold text-base sm:text-lg transition-colors shadow-lg shadow-amber-900/40"
          >
            Order Now →
          </Link>
        </div>
      </section>

      {/* ── Highlight strip ── */}
      <section className="bg-amber-400 py-4">
        <div className="max-w-4xl mx-auto px-6 flex flex-wrap justify-center gap-x-10 gap-y-2 text-amber-950 text-sm font-semibold tracking-wide">
          <span>🤲 Hand-Rolled Every Day</span>
          <span>🌅 Baked Fresh Each Morning</span>
          <span>🥪 Made-to-Order Sandwiches</span>
          <span>🧀 Artisan Cream Cheeses</span>
        </div>
      </section>

      {/* ── Feature showcase ── */}
      <section className="max-w-6xl mx-auto px-6 py-20 w-full">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-4">
          What Makes Us Different
        </h2>
        <p className="text-center text-stone-500 mb-14 max-w-xl mx-auto">
          We take the old-school craft seriously. Every step, every ingredient, every morning.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {HIGHLIGHTS.map((h) => (
            <div
              key={h.title}
              className="group relative overflow-hidden rounded-2xl shadow-sm hover:shadow-xl transition-shadow duration-300 bg-white border border-stone-100"
            >
              {/* image placeholder */}
              <div className={`h-52 flex items-center justify-center text-7xl ${h.bg}`}>
                {h.emoji}
              </div>
              {/* content */}
              <div className="p-6">
                <h3 className="text-lg font-bold mb-2 text-stone-900">{h.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{h.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cream cheese flavours ── */}
      <section className="bg-amber-50 border-y border-amber-100 py-16">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">Our Cream Cheeses</h2>
          <p className="text-stone-500 mb-12 max-w-xl mx-auto">
            House-made spreads crafted in small batches — from classic to creative.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {CREAM_CHEESES.map((cc) => (
              <div
                key={cc.name}
                className="flex flex-col items-center bg-white rounded-2xl p-5 shadow-sm border border-amber-100 hover:border-amber-300 transition-colors"
              >
                <span className="text-4xl mb-3">{cc.emoji}</span>
                <span className="text-sm font-semibold text-stone-800 text-center leading-snug">
                  {cc.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Order CTA banner ── */}
      <section className="bg-stone-900 text-white py-20 text-center px-6">
        <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
          Ready for the freshest bagel of your life?
        </h2>
        <p className="text-stone-400 mb-10 text-lg max-w-lg mx-auto">
          Browse our full menu and place your order — we&apos;ll make it the moment it comes in.
        </p>
        <Link
          href="/order"
          className="inline-block px-12 py-4 rounded-full bg-amber-400 hover:bg-amber-300 text-stone-900 font-bold text-lg transition-colors shadow-lg"
        >
          See Our Menu →
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-stone-950 text-stone-500 py-6 px-6 flex items-center justify-between text-xs">
        <span>© {new Date().getFullYear()} Bagels Beyond. All rights reserved.</span>
        <Link
          href="/login"
          className="hover:text-stone-300 transition-colors"
        >
          Staff Login
        </Link>
      </footer>

    </div>
  );
}

const HIGHLIGHTS = [
  {
    emoji: "🤲",
    title: "Hand-Rolled Bagels",
    description:
      "Each bagel is shaped by hand using our traditional technique — giving it that perfect chew and authentic crust you just can't get from a machine.",
    bg: "bg-gradient-to-br from-amber-100 to-orange-100",
  },
  {
    emoji: "🌅",
    title: "Baked Fresh Every Morning",
    description:
      "We start baking before sunrise so that by the time you walk in, the bagels are still warm. No day-old bread — ever.",
    bg: "bg-gradient-to-br from-orange-100 to-yellow-100",
  },
  {
    emoji: "🥪",
    title: "Made-to-Order Sandwiches",
    description:
      "Your sandwich is built the second you order it. Fresh ingredients, sliced to order, assembled with care — because great food is worth the wait.",
    bg: "bg-gradient-to-br from-lime-100 to-emerald-100",
  },
  {
    emoji: "🧀",
    title: "Artisan Cream Cheeses",
    description:
      "Choose from our house-made cream cheese selection. Classic plain, herb & garlic, berry, jalapeño, and more — made in small batches daily.",
    bg: "bg-gradient-to-br from-yellow-100 to-amber-100",
  },
];

const CREAM_CHEESES = [
  { emoji: "⬜", name: "Plain" },
  { emoji: "🌿", name: "Herb & Garlic" },
  { emoji: "🍓", name: "Strawberry" },
  { emoji: "🫐", name: "Blueberry" },
  { emoji: "🌶️", name: "Jalapeño" },
  { emoji: "🥑", name: "Avocado" },
];
