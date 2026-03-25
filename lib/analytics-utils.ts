export function formatCurrencyNZD(amount: number): string {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(amount);
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function getPercentageChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function getTrendLabel(current: number, previous: number): string {
  if (previous === 0) return "—";
  const change = getPercentageChange(current, previous);
  if (Math.abs(change) < 0.05) return "—";
  const sign = change > 0 ? "+" : "";
  const arrow = change > 0 ? "▲" : "▼";
  return `${arrow} ${sign}${change.toFixed(1)}%`;
}

export function getTrendColorClass(
  current: number,
  previous: number,
  higherIsBetter = true
): string {
  if (previous === 0) return "text-gray-500";
  const change = current - previous;
  if (Math.abs(change) < 0.0001) return "text-gray-500";
  const isImprovement = higherIsBetter ? change > 0 : change < 0;
  return isImprovement ? "text-green-600" : "text-red-600";
}

export function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  // Monday = 1, so offset: Mon->0, Tue->1, ..., Sun->6
  const offset = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - offset);
  return d;
}

export function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const d = new Date(start);
  d.setDate(start.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function formatWeekLabel(start: Date, end: Date): string {
  const sm = start.getMonth() + 1;
  const sd = start.getDate();
  const em = end.getMonth() + 1;
  const ed = end.getDate();
  return `${sm}/${sd} ~ ${em}/${ed}`;
}

export function formatMonthLabel(year: number, month: number): string {
  return `${year}년 ${month}월`;
}

export function buildComparablePreviousPeriod(
  startDate: Date,
  endDate: Date
): { previousStart: Date; previousEnd: Date } {
  const diffMs = endDate.getTime() - startDate.getTime();
  const previousEnd = new Date(startDate.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - diffMs);
  return { previousStart, previousEnd };
}
