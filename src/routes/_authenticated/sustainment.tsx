import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import {
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/ironiq/layout-primitives";
import { Tag } from "@/components/ironiq/badges";
import { useSustainmentRollup } from "@/lib/sustainment-api";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sustainment")({
  head: () => ({
    meta: [
      { title: "Sustainment — IronIQ" },
      {
        name: "description",
        content:
          "Is a fix still holding? Combines human-reported check-ins with real IronIQ Edge telemetry.",
      },
    ],
  }),
  component: SustainmentPage,
});

const SUSTAINMENT_FIELD_LABELS: {
  key:
    | "improvement_holding"
    | "repeatable"
    | "process_controlled"
    | "knowledge_documented"
    | "others_can_execute"
    | "performance_measured"
    | "capability_stable";
  label: string;
}[] = [
  { key: "improvement_holding", label: "Still working" },
  { key: "repeatable", label: "Repeatable" },
  { key: "process_controlled", label: "Controlled" },
  { key: "knowledge_documented", label: "Documented" },
  { key: "others_can_execute", label: "Others can execute" },
  { key: "performance_measured", label: "Measured" },
  { key: "capability_stable", label: "Stable" },
];

function BoolDot({ value }: { value: boolean | null }) {
  if (value === null)
    return (
      <HelpCircle
        className="size-3.5 text-muted-foreground"
        aria-label="Not answered"
      />
    );
  return value ? (
    <CheckCircle2 className="size-3.5 text-success" aria-label="Yes" />
  ) : (
    <AlertTriangle className="size-3.5 text-destructive" aria-label="No" />
  );
}

function SustainmentPage() {
  const rollup = useSustainmentRollup();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        eyebrow="Reports"
        title="Sustainment"
        description="Is a fix still holding? Combines human-reported check-ins from the Capability Assessment with real IronIQ Edge telemetry comparing current machine performance against the original improvement."
      />

      {rollup.isError ? (
        <EmptyState
          message={
            rollup.error instanceof Error
              ? rollup.error.message
              : "Could not load sustainment data."
          }
        />
      ) : null}

      <Panel title="Telemetry-verified: machine improvements">
        {!rollup.data?.eventsAvailable ? (
          <EmptyState message="No machine event data available yet — this needs IronIQ Edge connected and reporting for at least one facility." />
        ) : rollup.data.telemetryChecks.length === 0 ? (
          <EmptyState message="No improvements old enough yet to compare against current performance, or none recorded." />
        ) : (
          <div className="space-y-3">
            {rollup.data.telemetryChecks.map((check) => (
              <div
                key={check.improvement_id}
                className="rounded-md border border-border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {check.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {check.machine_label}
                      {check.part_number ? ` · part ${check.part_number}` : ""}
                      {" · changed "}
                      {formatDate(check.changed_at)}
                    </p>
                  </div>
                  <Tag
                    token={
                      check.drift.status === "holding"
                        ? "success"
                        : check.drift.status === "drifting"
                          ? "critical"
                          : "steel"
                    }
                  >
                    {check.drift.status === "holding"
                      ? "Holding"
                      : check.drift.status === "drifting"
                        ? "Drifting"
                        : "Not enough data"}
                  </Tag>
                </div>
                {check.drift.percentChange != null ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {check.drift.originalHoursPerPart?.toFixed(3)} hrs/part
                    originally → {check.drift.currentHoursPerPart?.toFixed(3)}{" "}
                    hrs/part now ({check.drift.percentChange > 0 ? "+" : ""}
                    {check.drift.percentChange.toFixed(1)}%)
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Human-reported: capability assessment check-ins">
        {!rollup.data || rollup.data.humanChecks.length === 0 ? (
          <EmptyState message="No sustainment check-ins recorded yet — these come from the Restoration panel on a Capability Assessment's actions." />
        ) : (
          <div className="space-y-3">
            {rollup.data.humanChecks.map((check) => (
              <div
                key={check.action_id}
                className="rounded-md border border-border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {check.action_title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {check.assessment_name} · checked{" "}
                      {formatDate(check.validated_on)}
                    </p>
                  </div>
                  <Tag
                    token={
                      check.result === "capability_restored" ||
                      check.result === "capability_strengthened"
                        ? "success"
                        : check.result === "performance_degraded" ||
                            check.result === "additional_action_required"
                          ? "critical"
                          : "steel"
                    }
                  >
                    {check.result.replaceAll("_", " ")}
                  </Tag>
                </div>
                <div className="mt-2 flex flex-wrap gap-3">
                  {SUSTAINMENT_FIELD_LABELS.map((f) => (
                    <span
                      key={f.key}
                      className="flex items-center gap-1 text-xs text-muted-foreground"
                    >
                      <BoolDot value={check[f.key]} />
                      {f.label}
                    </span>
                  ))}
                </div>
                {check.notes ? (
                  <p className="mt-2 text-xs italic text-muted-foreground">
                    {check.notes}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
