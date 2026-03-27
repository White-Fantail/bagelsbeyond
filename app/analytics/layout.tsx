import AnalyticsSubNav from "@/components/analytics/AnalyticsSubNav";

const subNavItems = [
  { href: "/analytics", label: "Analytics Home" },
  { href: "/analytics/daily", label: "Daily" },
  { href: "/analytics/weekly", label: "Weekly" },
  { href: "/analytics/monthly", label: "Monthly" },
  { href: "/analytics/segments", label: "Segments" },
];

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
        <AnalyticsSubNav items={subNavItems} />
      </div>
      {children}
    </div>
  );
}
