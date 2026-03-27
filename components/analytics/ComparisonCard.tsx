type Props = {
  title: string;
  segmentLabel: string;
  baselineLabel: string;
  segmentValue: string;
  baselineValue: string;
  diffPercent: number;
  unit?: string;
  higherIsBetter?: boolean;
};

export default function ComparisonCard({
  title,
  segmentLabel,
  baselineLabel,
  segmentValue,
  baselineValue,
  diffPercent,
  unit = "",
  higherIsBetter = true,
}: Props) {
  const isPositive = diffPercent > 0;
  const isBetter = higherIsBetter ? isPositive : !isPositive;
  const diffColor =
    Math.abs(diffPercent) < 0.1
      ? "text-gray-500"
      : isBetter
      ? "text-green-600"
      : "text-red-600";
  const diffArrow = Math.abs(diffPercent) < 0.1 ? "—" : isPositive ? "▲" : "▼";

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-sm font-medium text-gray-500 mb-3">{title}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
          <p className="text-xs text-amber-600 mb-1">{segmentLabel}</p>
          <p className="text-lg font-bold text-amber-900">
            {segmentValue}
            {unit && <span className="text-sm font-normal ml-1">{unit}</span>}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">{baselineLabel}</p>
          <p className="text-lg font-bold text-gray-700">
            {baselineValue}
            {unit && <span className="text-sm font-normal ml-1">{unit}</span>}
          </p>
        </div>
      </div>
      {Math.abs(diffPercent) >= 0.1 && (
        <div className={`mt-2 text-sm font-medium ${diffColor}`}>
          {diffArrow}{" "}
          {isPositive ? "+" : ""}
          {diffPercent.toFixed(1)}% (segments baseline)
        </div>
      )}
    </div>
  );
}
