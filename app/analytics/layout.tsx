import AnalyticsSubNav from "@/components/analytics/AnalyticsSubNav";

const subNavItems = [
  { href: "/analytics", label: "분석 홈" },
  { href: "/analytics/daily", label: "일별" },
  { href: "/analytics/weekly", label: "주별" },
  { href: "/analytics/monthly", label: "월별" },
  { href: "/analytics/segments", label: "세그먼트" },
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
