import type { PeriodComparison } from "@/lib/services/analytics";
import { formatCurrencyNZD, formatPercentage } from "@/lib/analytics-utils";

type Props = {
  comparison: PeriodComparison;
};

function ChangeRow({
  label,
  currentValue,
  previousValue,
  change,
  changePercent,
  higherIsBetter = true,
}: {
  label: string;
  currentValue: string;
  previousValue: string;
  change: number;
  changePercent: number;
  higherIsBetter?: boolean;
}) {
  const isBetter = higherIsBetter ? change > 0 : change < 0;
  const colorClass =
    Math.abs(changePercent) < 0.1
      ? "text-gray-500"
      : isBetter
      ? "text-green-600"
      : "text-red-600";
  const arrow = Math.abs(changePercent) < 0.1 ? "—" : change > 0 ? "▲" : "▼";

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="text-right">
        <span className="text-sm font-medium text-gray-900">{currentValue}</span>
        <span className="text-xs text-gray-400 mx-2">← {previousValue}</span>
        <span className={`text-xs font-medium ${colorClass}`}>
          {arrow}{" "}
          {Math.abs(changePercent) >= 0.1
            ? `${change > 0 ? "+" : ""}${changePercent.toFixed(1)}%`
            : ""}
        </span>
      </div>
    </div>
  );
}

export default function PeriodComparisonSection({ comparison }: Props) {
  const { current, previous } = comparison;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Period Comparison ({current.startDate} ~ {current.endDate} vs{" "}
        {previous.startDate} ~ {previous.endDate})
      </h3>
      <div className="space-y-0">
        <ChangeRow
          label="Total Sales"
          currentValue={formatCurrencyNZD(current.totalSales)}
          previousValue={formatCurrencyNZD(previous.totalSales)}
          change={comparison.salesChange}
          changePercent={comparison.salesChangePercent}
        />
        <ChangeRow
          label="Daily Avg. Sales"
          currentValue={formatCurrencyNZD(current.averageDailySales)}
          previousValue={formatCurrencyNZD(previous.averageDailySales)}
          change={comparison.avgSalesChange}
          changePercent={comparison.avgSalesChangePercent}
        />
        <ChangeRow
          label="Total Sold Bagels"
          currentValue={`${current.totalBagelsSold}`}
          previousValue={`${previous.totalBagelsSold}`}
          change={comparison.bagelsSoldChange}
          changePercent={comparison.bagelsSoldChangePercent}
        />
        <ChangeRow
          label="Avg. Waste Rate"
          currentValue={formatPercentage(current.wasteRate)}
          previousValue={formatPercentage(previous.wasteRate)}
          change={comparison.wasteRateChange}
          changePercent={comparison.wasteRateChange * 100}
          higherIsBetter={false}
        />
        <ChangeRow
          label="Store Sales Share"
          currentValue={`${current.storePercent.toFixed(1)}%`}
          previousValue={`${previous.storePercent.toFixed(1)}%`}
          change={comparison.storePercentChange}
          changePercent={comparison.storePercentChange}
        />
        <ChangeRow
          label="Uber Eats Share"
          currentValue={`${current.uberPercent.toFixed(1)}%`}
          previousValue={`${previous.uberPercent.toFixed(1)}%`}
          change={comparison.uberPercentChange}
          changePercent={comparison.uberPercentChange}
        />
        <ChangeRow
          label="DoorDash Share"
          currentValue={`${current.doordashPercent.toFixed(1)}%`}
          previousValue={`${previous.doordashPercent.toFixed(1)}%`}
          change={comparison.doordashPercentChange}
          changePercent={comparison.doordashPercentChange}
        />
      </div>
    </div>
  );
}
