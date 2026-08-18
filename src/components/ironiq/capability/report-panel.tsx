import { useState } from "react";
import { Panel } from "@/components/ironiq/layout-primitives";
import { Button } from "@/components/ui/button";
import { AiBadge } from "./shared";
import { draftReportNarrative } from "@/lib/capability-ai.functions";
import { toast } from "sonner";
import { Loader2, Printer, Sparkles } from "lucide-react";
import type {
  CapActionRow,
  CapAssessmentRow,
  CapDomainRow,
  CapFindingRow,
  CapImpactRow,
  CapProblemRow,
  CapResultRow,
  CapRootGapRow,
  CapValidationRow,
} from "@/lib/capability-domain";
import { PERF_CATEGORY_LABELS, PRIORITY_LABELS } from "@/lib/capability-domain";
import {
  formatValue,
  summarizeImprovement,
  type CapabilityResult,
} from "@/lib/capability-scoring";
import { formatDate } from "@/lib/utils";

export function ReportPanel({
  assessment,
  result,
  problem,
  impacts,
  findings,
  gaps,
  actions,
  results,
  validations,
  domains,
  aiContext,
}: {
  assessment: CapAssessmentRow;
  result: CapabilityResult;
  problem: CapProblemRow | null;
  impacts: CapImpactRow[];
  findings: CapFindingRow[];
  gaps: CapRootGapRow[];
  actions: CapActionRow[];
  results: CapResultRow[];
  validations: CapValidationRow[];
  domains: CapDomainRow[];
  aiContext: string;
}) {
  const [narrative, setNarrative] = useState<Record<string, string> | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const domainById = new Map(domains.map((d) => [d.id, d]));
  const approved = findings.filter((f) => f.approved);
  const primary =
    approved.find((f) => f.classification === "primary_constraint") ?? null;

  async function runAi() {
    setBusy(true);
    try {
      const out = (await draftReportNarrative({
        data: { context: aiContext },
      })) as Record<string, string>;
      setNarrative(out);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI assistance unavailable");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Panel
        title="Ironclad Manufacturing Capability Review"
        subtitle="Outcome-focused review of the operation's ability to perform, not an audit of documents."
        actions={
          <div className="no-print flex gap-2">
            <Button variant="outline" onClick={runAi} disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Draft narrative
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="size-4" /> Print / PDF
            </Button>
          </div>
        }
      >
        <article className="space-y-6 text-sm">
          <header>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-foreground">
              {assessment.name}
            </h2>
            <p className="text-muted-foreground">
              {formatDate(assessment.assessment_date)} • Lead assessor:{" "}
              {assessment.lead_assessor ?? "—"}
            </p>
          </header>

          <Section title="Executive Summary">
            {narrative?.["executive_summary"] ? (
              <>
                <AiBadge label="AI draft — assessor review required" />
                <p className="mt-2">{narrative["executive_summary"]}</p>
              </>
            ) : (
              <p className="text-muted-foreground">
                Operational capability score{" "}
                {result.overall === null
                  ? "—"
                  : `${result.overall.toFixed(1)} / 5.0`}{" "}
                with {result.severeCount} severe constraint
                {result.severeCount === 1 ? "" : "s"} identified across{" "}
                {result.domains.filter((d) => d.score !== null).length} assessed
                capability domains.
              </p>
            )}
          </Section>

          <Section title="Customer-Stated Problem">
            <p>{problem?.stated_problem ?? "Not captured."}</p>
            <p className="text-muted-foreground">{problem?.location_process}</p>
          </Section>

          <Section title="Operational Performance Impact">
            {impacts.length === 0 ? (
              <p className="text-muted-foreground">
                No performance impacts recorded.
              </p>
            ) : (
              <ul className="space-y-1">
                {impacts.map((i) => (
                  <li key={i.id}>
                    <strong>{PERF_CATEGORY_LABELS[i.category]}</strong> —{" "}
                    {i.current_condition || "—"}
                    {i.metric_name
                      ? ` (${i.metric_name}: ${formatValue(i.current_value, i.unit)} → target ${formatValue(i.target_value, i.unit)})`
                      : ""}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Capability Assessment">
            {narrative?.["capability_assessment"] ? (
              <p className="mb-2">{narrative["capability_assessment"]}</p>
            ) : null}
            <ul className="space-y-1">
              {result.domains.map((d) => (
                <li key={d.domain.id}>
                  <strong>{d.domain.name}</strong> ({d.domain.verb}):{" "}
                  {d.score === null
                    ? "not rated"
                    : `${d.score.toFixed(1)} / 5.0`}
                  {d.severeCount
                    ? ` — ${d.severeCount} severe constraint(s)`
                    : ""}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Key Findings">
            {approved.length === 0 ? (
              <p className="text-muted-foreground">
                No approved findings. Only approved findings appear in the
                report.
              </p>
            ) : (
              <ul className="space-y-2">
                {approved.map((f) => (
                  <li key={f.id}>
                    <strong>{f.title}</strong> — {f.finding_text}
                    <br />
                    <span className="text-muted-foreground">
                      {f.domain_id ? domainById.get(f.domain_id)?.name : "—"} •{" "}
                      {f.classification.replaceAll("_", " ")} • {f.severity} •{" "}
                      {f.confidence} confidence •{" "}
                      {f.source.replaceAll("_", " ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Primary Constraint">
            <p>{primary ? primary.title : "Not yet established."}</p>
            {narrative?.["constraint_narrative"] ? (
              <p className="mt-2">{narrative["constraint_narrative"]}</p>
            ) : null}
          </Section>

          <Section title="Root Capability Gap">
            {gaps.length === 0 ? (
              <p className="text-muted-foreground">
                No root capability gaps identified.
              </p>
            ) : (
              <ul className="space-y-2">
                {gaps.map((g) => (
                  <li key={g.id}>
                    <strong>{g.root_gap}</strong>
                    {g.validated ? "" : " — suspected, validation required"}
                    <br />
                    <span className="text-muted-foreground">
                      Observed: {g.observed_problem}. Immediate cause:{" "}
                      {g.immediate_cause ?? "—"}. Consequence:{" "}
                      {g.operational_consequence ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Recommended Restoration Actions & Priority Roadmap">
            {narrative?.["roadmap_narrative"] ? (
              <p className="mb-2">{narrative["roadmap_narrative"]}</p>
            ) : null}
            {actions.length === 0 ? (
              <p className="text-muted-foreground">
                No restoration actions defined.
              </p>
            ) : (
              <ul className="space-y-2">
                {actions.map((a) => {
                  const imp = summarizeImprovement(
                    a,
                    results.filter((r) => r.action_id === a.id),
                  );
                  const val = validations
                    .filter((v) => v.action_id === a.id)
                    .at(-1);
                  return (
                    <li key={a.id}>
                      <strong>[{PRIORITY_LABELS[a.priority]}]</strong>{" "}
                      {a.recommended_action}
                      <br />
                      <span className="text-muted-foreground">
                        {a.metric_name ?? "Metric"}: baseline{" "}
                        {formatValue(imp.baseline, a.unit)} → target{" "}
                        {formatValue(imp.target, a.unit)} → measured{" "}
                        {formatValue(imp.actual, a.unit)} • owner{" "}
                        {a.responsible_party ?? "—"} •{" "}
                        {a.status.replaceAll("_", " ")}
                        {val
                          ? ` • sustainment: ${val.result.replaceAll("_", " ")}`
                          : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <footer className="border-t border-border pt-4 text-xs uppercase tracking-widest text-muted-foreground">
            Ironclad Sustainment Solutions — Restore Capability. Preserve
            Readiness.®
          </footer>
        </article>
      </Panel>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="eyebrow">{title}</h3>
      <div className="mt-2 space-y-1">{children}</div>
    </section>
  );
}
