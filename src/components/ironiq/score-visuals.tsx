import { cn } from "@/lib/utils";
import {
  formatScore,
  readinessToken,
  type ReadinessLevel,
} from "@/lib/scoring";

const ringToken: Record<string, string> = {
  critical: "text-critical",
  high: "text-high",
  medium: "text-medium",
  low: "text-low",
  success: "text-success",
  steel: "text-steel",
  primary: "text-primary",
};

export function ScoreDial({
  value,
  label,
  level,
  suffix = "",
  size = 148,
}: {
  value: number | null;
  label: string;
  level?: ReadinessLevel | null;
  suffix?: string;
  size?: number;
}) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const token = level ? readinessToken(level) : "primary";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-border"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="butt"
            strokeDasharray={`${(pct / 100) * c} ${c}`}
            className={cn(
              "transition-all duration-700",
              ringToken[token] ?? ringToken.primary,
            )}
            stroke="currentColor"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="metric text-4xl font-semibold text-foreground">
            {formatScore(value)}
            <span className="text-xl text-muted-foreground">{suffix}</span>
          </span>
        </div>
      </div>
      <p className="eyebrow text-center">{label}</p>
    </div>
  );
}

export function StatCard({
  label,
  value,
  unit,
  hint,
  token = "steel",
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  token?: keyof typeof ringToken;
}) {
  return (
    <div className="panel px-5 py-4">
      <p className="eyebrow">{label}</p>
      <p className={cn("metric mt-2 text-3xl font-semibold", ringToken[token])}>
        {value}
        {unit ? (
          <span className="ml-0.5 text-lg text-muted-foreground">{unit}</span>
        ) : null}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function CategoryBar({
  name,
  weight,
  score,
  onSelect,
}: {
  name: string;
  weight: number;
  score: number | null;
  onSelect?: () => void;
}) {
  const pct = score ?? 0;
  const token =
    score === null
      ? "steel"
      : pct >= 80
        ? "success"
        : pct >= 70
          ? "medium"
          : pct >= 60
            ? "high"
            : "critical";
  const bg: Record<string, string> = {
    success: "bg-success",
    medium: "bg-medium",
    high: "bg-high",
    critical: "bg-critical",
    steel: "bg-steel",
  };
  const Wrapper = onSelect ? "button" : "div";
  return (
    <Wrapper
      {...(onSelect
        ? {
            type: "button" as const,
            onClick: onSelect,
            "aria-label": `View details for ${name}`,
          }
        : {})}
      className={cn(
        "w-full text-left",
        onSelect &&
          "group cursor-pointer rounded-sm outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring -mx-2 px-2 py-1",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-sm text-foreground">
          {name}{" "}
          <span className="text-xs text-muted-foreground">· {weight}%</span>
        </p>
        <p className="metric text-sm font-semibold text-foreground">
          {formatScore(score)}
        </p>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-sm bg-muted">
        <div
          className={cn("h-full transition-all duration-700", bg[token])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </Wrapper>
  );
}
