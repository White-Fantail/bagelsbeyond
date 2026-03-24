type Color = "amber" | "blue" | "green" | "red" | "gray";

type Props = {
  title: string;
  value: string | number;
  sub?: string;
  color?: Color;
};

const borderColors: Record<Color, string> = {
  amber: "border-t-amber-500",
  blue: "border-t-blue-500",
  green: "border-t-green-500",
  red: "border-t-red-500",
  gray: "border-t-gray-400",
};

export default function StatCard({ title, value, sub, color = "amber" }: Props) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 border-t-4 ${borderColors[color]} p-5`}>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
