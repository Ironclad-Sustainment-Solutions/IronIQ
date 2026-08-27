import type { ReactNode } from "react";
import { Tag } from "@/components/ironiq/badges";
import { cn } from "@/lib/utils";
import {
  ACTION_STATUS_LABELS,
  CONFIDENCE_LABELS,
  FINDING_CLASS_LABELS,
  PRIORITY_LABELS,
  SOURCE_LABELS,
  VALIDATION_RESULT_LABELS,
  type CapActionStatus,
  type CapConfidence,
  type CapFindingClass,
  type CapPriority,
  type CapSource,
  type CapValidationResult,
} from "@/lib/capability-domain";
import { scoreToken } from "@/lib/capability-scoring";
import { Sparkles } from "lucide-react";

type Token =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "opportunity"
  | "success"
  | "steel"
  | "primary";

const classToken: Record<CapFindingClass, Token> = {
  primary_constraint: "critical",
  contributing_constraint: "high",
  risk: "medium",
  opportunity: "opportunity",
  strength: "success",
};

export function ClassificationBadge({ value }: { value: CapFindingClass }) {
  return <Tag token={classToken[value]}>{FINDING_CLASS_LABELS[value]}</Tag>;
}

const confidenceToken: Record<CapConfidence, Token> = {
  low: "critical",
  moderate: "medium",
  high: "primary",
  verified: "success",
};

export function ConfidenceBadge({ value }: { value: CapConfidence }) {
  return (
    <Tag token={confidenceToken[value]}>
      {CONFIDENCE_LABELS[value]} confidence
    </Tag>
  );
}

export function SourceBadge({ value }: { value: CapSource }) {
  return (
    <Tag token={value === "ironclad_validated" ? "primary" : "steel"}>
      {SOURCE_LABELS[value]}
    </Tag>
  );
}

const priorityToken: Record<CapPriority, Token> = {
  immediate: "critical",
  high: "high",
  moderate: "medium",
  monitor: "steel",
};

export function PriorityBadge({ value }: { value: CapPriority }) {
  return <Tag token={priorityToken[value]}>{PRIORITY_LABELS[value]}</Tag>;
}

const actionToken: Record<CapActionStatus, Token> = {
  identified: "steel",
  recommended: "medium",
  approved: "primary",
  in_progress: "primary",
  validation: "low",
  complete: "success",
  sustained: "success",
};

export function ActionStatusBadge({ value }: { value: CapActionStatus }) {
  return <Tag token={actionToken[value]}>{ACTION_STATUS_LABELS[value]}</Tag>;
}

const validationToken: Record<CapValidationResult, Token> = {
  capability_restored: "success",
  capability_strengthened: "success",
  partially_restored: "medium",
  additional_action_required: "high",
  performance_degraded: "critical",
};

export function ValidationBadge({ value }: { value: CapValidationResult }) {
  return (
    <Tag token={validationToken[value]}>{VALIDATION_RESULT_LABELS[value]}</Tag>
  );
}

export function AiBadge({
  label = "AI suggestion — requires review",
}: {
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-primary/40 bg-primary/10 px-2 py-0.5 font-display text-[11px] font-semibold uppercase tracking-widest text-primary">
      <Sparkles className="size-3" aria-hidden />
      {label}
    </span>
  );
}

/** 0–5 rating chip. */
export function ScoreChip({
  score,
  size = "md",
}: {
  score: number | null;
  size?: "sm" | "md";
}) {
  const token = scoreToken(score);
  const map: Record<string, string> = {
    critical: "border-critical/50 bg-critical/15 text-critical",
    high: "border-high/50 bg-high/15 text-high",
    medium: "border-medium/50 bg-medium/15 text-medium",
    success: "border-success/50 bg-success/15 text-success",
    steel: "border-border bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-sm border font-display font-semibold tabular-nums",
        size === "sm"
          ? "h-6 min-w-9 px-1.5 text-xs"
          : "h-8 min-w-12 px-2 text-sm",
        map[token],
      )}
    >
      {score === null ? "—" : score.toFixed(1)}
    </span>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="eyebrow block">{children}</span>;
}

export function Meter({
  value,
  token,
}: {
  value: number | null;
  token: string;
}) {
  const map: Record<string, string> = {
    critical: "bg-critical",
    high: "bg-high",
    medium: "bg-medium",
    success: "bg-success",
    steel: "bg-muted-foreground/40",
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-[width]",
          map[token] ?? map["steel"],
        )}
        style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }}
      />
    </div>
  );
}
