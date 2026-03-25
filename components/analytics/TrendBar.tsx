type Props = {
  value: number;
  maxValue: number;
  color?: string;
};

export default function TrendBar({ value, maxValue, color = "bg-amber-500" }: Props) {
  const percent = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
      <div
        className={`h-3 rounded-full transition-all ${color}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
