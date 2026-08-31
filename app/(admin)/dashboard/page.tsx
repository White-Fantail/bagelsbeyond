import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

const cards = [
  {
    title: "Freshness",
    description: "Track made quantities, remaining quantities, shelf life and freshness history.",
    href: "/freshness",
    action: "Open Freshness Dashboard",
  },
  {
    title: "Freshness Logs",
    description: "Review production, remaining and discard records for freshness-managed items.",
    href: "/freshness/logs",
    action: "View Log History",
  },
  {
    title: "Category Settings",
    description: "Choose which product categories are managed by the freshness workflow.",
    href: "/freshness/categories",
    action: "Manage Categories",
  },
  {
    title: "Sales",
    description: "Sales records are retained for now and remain available separately from freshness management.",
    href: "/sales",
    action: "View Sales",
  },
];

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Operations Dashboard</h1>
        <p className="mt-1 text-gray-500">
          Bagels Beyond now focuses on freshness and shelf-life management. Sales data is retained for reference.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <div key={card.href} className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">{card.title}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">{card.description}</p>
            <Link
              href={card.href}
              className="mt-4 inline-flex text-sm font-medium text-amber-700 hover:text-amber-800 hover:underline"
            >
              {card.action} →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
