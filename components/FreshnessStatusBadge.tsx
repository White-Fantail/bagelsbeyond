import type { FreshnessStatus } from "@/lib/services/freshnessService";

interface FreshnessStatusBadgeProps {
  status: FreshnessStatus;
  daysElapsed: number | null;
  daysRemaining: number | null;
  shelfLifeDays: number | null;
}

const STATUS_CONFIG: Record<
  FreshnessStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  ok: {
    label: "신선",
    badgeClass: "bg-green-100 text-green-800 border border-green-200",
    dotClass: "bg-green-500",
  },
  warning: {
    label: "주의",
    badgeClass: "bg-yellow-100 text-yellow-800 border border-yellow-200",
    dotClass: "bg-yellow-500",
  },
  expired: {
    label: "기한초과",
    badgeClass: "bg-red-100 text-red-800 border border-red-200",
    dotClass: "bg-red-500",
  },
};

export default function FreshnessStatusBadge({
  status,
  daysElapsed,
  daysRemaining,
  shelfLifeDays,
}: FreshnessStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex flex-col items-start gap-1">
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.badgeClass}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
        {config.label}
      </span>
      {daysElapsed != null && (
        <span className="text-xs text-gray-500">
          {daysElapsed}일 경과
          {shelfLifeDays != null && daysRemaining != null && (
            <>
              {" "}
              /{" "}
              <span
                className={
                  daysRemaining < 0
                    ? "text-red-600 font-medium"
                    : daysRemaining === 0
                    ? "text-orange-600 font-medium"
                    : "text-gray-600"
                }
              >
                {daysRemaining < 0
                  ? `${Math.abs(daysRemaining)}일 초과`
                  : daysRemaining === 0
                  ? "오늘 만료"
                  : `${daysRemaining}일 남음`}
              </span>
            </>
          )}
        </span>
      )}
    </div>
  );
}
