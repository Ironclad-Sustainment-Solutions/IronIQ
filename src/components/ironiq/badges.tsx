import { cn } from "@/lib/utils";
import {
  FINDING_STATUS_LABELS,
  SEVERITY_LABELS,
  ASSESSMENT_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  type AssessmentStatus,
  type FindingSeverity,
  type FindingStatus,
  type ProjectStatus,
} from "@/lib/domain";
import { readinessToken, type ReadinessLevel } from "@/lib/scoring";

const base =
  "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-display text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap";

const tokenClass: Record<string, string> = {
  critical: "border-critical/50 bg-critical/15 text-critical",
  high: "border-high/50 bg-high/15 text-high",
  medium: "border-medium/50 bg-medium/15 text-medium",
  low: "border-low/50 bg-low/15 text-low",
  opportunity: "border-opportunity/50 bg-opportunity/15 text-opportunity",
  success: "border-success/50 bg-success/15 text-success",
  steel: "border-border bg-muted text-muted-foreground",
  primary: "border-primary/50 bg-primary/15 text-primary",
};

export function Tag({
  token,
  children,
}: {
  token: keyof typeof tokenClass;
  children: React.ReactNode;
}) {
  return (
    <span className={cn(base, tokenClass[token] ?? tokenClass.steel)}>
      {children}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  return <Tag token={severity}>{SEVERITY_LABELS[severity]}</Tag>;
}

const findingStatusToken: Record<FindingStatus, keyof typeof tokenClass> = {
  open: "high",
  assigned: "medium",
  in_progress: "primary",
  awaiting_verification: "low",
  closed: "success",
  accepted_risk: "steel",
};

export function FindingStatusBadge({ status }: { status: FindingStatus }) {
  return (
    <Tag token={findingStatusToken[status]}>
      {FINDING_STATUS_LABELS[status]}
    </Tag>
  );
}

const assessmentStatusToken: Record<AssessmentStatus, keyof typeof tokenClass> =
  {
    draft: "steel",
    in_progress: "primary",
    review: "medium",
    finalized: "success",
    reopened: "high",
  };

export function AssessmentStatusBadge({
  status,
}: {
  status: AssessmentStatus;
}) {
  return (
    <Tag token={assessmentStatusToken[status]}>
      {ASSESSMENT_STATUS_LABELS[status]}
    </Tag>
  );
}

const projectStatusToken: Record<ProjectStatus, keyof typeof tokenClass> = {
  proposed: "steel",
  planned: "low",
  in_progress: "primary",
  on_hold: "medium",
  complete: "success",
  cancelled: "steel",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Tag token={projectStatusToken[status]}>
      {PROJECT_STATUS_LABELS[status]}
    </Tag>
  );
}

export function ReadinessBadge({ level }: { level: ReadinessLevel | null }) {
  if (!level) return <Tag token="steel">Not scored</Tag>;
  return (
    <Tag token={readinessToken(level) as keyof typeof tokenClass}>{level}</Tag>
  );
}
