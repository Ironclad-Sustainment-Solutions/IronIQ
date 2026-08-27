import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BLOCKING_STATUSES,
  JOB_STATUS_META,
  type JobStatus,
  type ProductionStage,
} from "@/lib/workflow";

const STAGE_CLASS: Record<ProductionStage, string> = {
  Intake: "border-muted-foreground/40 bg-muted/40 text-muted-foreground",
  Planning: "border-primary/40 bg-primary/10 text-primary",
  Programming: "border-primary/40 bg-primary/10 text-primary",
  Verification: "border-chart-2/40 bg-chart-2/10 text-chart-2",
  Approval: "border-chart-2/40 bg-chart-2/10 text-chart-2",
  Release: "border-chart-3/40 bg-chart-3/10 text-chart-3",
  Feedback: "border-chart-4/40 bg-chart-4/10 text-chart-4",
};

export function JobStatusBadge({
  status,
  className,
}: {
  status: JobStatus;
  className?: string;
}) {
  const meta = JOB_STATUS_META[status];
  const blocking = BLOCKING_STATUSES.includes(status);
  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap font-mono text-[10px] uppercase tracking-wider",
        blocking
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : STAGE_CLASS[meta.stage],
        className,
      )}
    >
      {meta.label}
    </Badge>
  );
}

export function StageBadge({ stage }: { stage: ProductionStage }) {
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] uppercase tracking-wider", STAGE_CLASS[stage])}
    >
      {stage}
    </Badge>
  );
}

export function PreliminaryNotice({ label }: { label: string }) {
  return (
    <p className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium uppercase tracking-wider text-primary">
      {label}
    </p>
  );
}
