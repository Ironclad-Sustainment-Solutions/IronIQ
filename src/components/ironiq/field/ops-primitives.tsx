/**
 * Touch-first primitives for shop-floor capture: large tap targets, quick
 * selects, live timers and numeric entry sized for gloved hands.
 */

import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Large single- or multi-select chip grid. */
export function QuickSelect({
  label,
  options,
  value,
  onChange,
  disabled,
  columns = 2,
}: {
  label?: string;
  options: readonly string[];
  value: string | null | undefined;
  onChange: (next: string) => void;
  disabled?: boolean;
  columns?: 1 | 2 | 3;
}) {
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      {label ? <legend className="eyebrow mb-1">{label}</legend> : null}
      <div
        className={cn(
          "grid gap-2",
          columns === 1
            ? "grid-cols-1"
            : columns === 3
              ? "grid-cols-2 sm:grid-cols-3"
              : "grid-cols-2",
        )}
      >
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onChange(opt)}
              className={cn(
                "min-h-12 rounded-sm border px-3 py-2 text-left text-sm font-medium transition-colors disabled:opacity-50",
                active
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Numeric entry that commits on blur, sized for touch. */
export function NumberField({
  label,
  value,
  onCommit,
  suffix,
  disabled,
  placeholder,
  step = "any",
}: {
  label?: string;
  value: number | null | undefined;
  onCommit: (v: number | null) => void;
  suffix?: string;
  disabled?: boolean;
  placeholder?: string;
  step?: string;
}) {
  const id = useId();
  const [text, setText] = useState(
    value === null || value === undefined ? "" : String(value),
  );
  useEffect(
    () => setText(value === null || value === undefined ? "" : String(value)),
    [value],
  );
  const commit = () => {
    const trimmed = text.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && Number.isNaN(next)) {
      setText(value === null || value === undefined ? "" : String(value));
      return;
    }
    if (next !== (value ?? null)) onCommit(next);
  };
  return (
    <div className="grid gap-1.5">
      {label ? (
        <Label htmlFor={id} className="eyebrow">
          {label}
        </Label>
      ) : null}
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          className="h-11 text-base"
        />
        {suffix ? (
          <span className="shrink-0 text-xs text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** 1–5 rating pad used by the pilot decision aid. */
export function ScorePad({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <p className="eyebrow">{label}</p>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            aria-label={`${label}: ${n}`}
            disabled={disabled}
            onClick={() => onChange(n)}
            className={cn(
              "min-h-11 rounded-sm border text-sm font-semibold transition-colors disabled:opacity-50",
              value === n
                ? "border-primary bg-primary/20 text-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Elapsed time since a start timestamp, ticking once per second. */
export function LiveTimer({
  startedAt,
  className,
}: {
  startedAt?: string | null;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!startedAt)
    return (
      <span
        className={cn("font-mono text-sm text-muted-foreground", className)}
      >
        —
      </span>
    );
  const secs = Math.max(
    0,
    Math.floor((now - new Date(startedAt).getTime()) / 1000),
  );
  const h = String(Math.floor(secs / 3600)).padStart(2, "0");
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return (
    <span
      className={cn(
        "font-mono text-lg font-semibold tabular-nums text-primary",
        className,
      )}
    >
      {h}:{m}:{s}
    </span>
  );
}

export function BigAction({
  label,
  hint,
  onClick,
  disabled,
  active,
  icon,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-16 flex-col justify-center rounded-sm border px-4 py-3 text-left transition-colors disabled:opacity-50",
        active
          ? "border-primary bg-primary/15"
          : "border-border bg-card hover:border-primary/50 hover:bg-primary/5",
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        {label}
      </span>
      {hint ? (
        <span className="mt-0.5 text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </button>
  );
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-sm border border-border bg-card p-3">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-foreground">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function InlineNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-sm border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      {children}
    </p>
  );
}

export function DeleteButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      Remove
    </Button>
  );
}
