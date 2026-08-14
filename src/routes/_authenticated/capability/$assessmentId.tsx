import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, EmptyState, Panel } from "@/components/ironiq/layout-primitives";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ironiq/badges";
import {
  useCapAssessment,
  useCapWorkspace,
  useCapabilityLibrary,
  useSetAssessmentScore,
} from "@/lib/capability-api";
import { useCapInvestigation } from "@/lib/capability-investigation-api";
import { computeCapability } from "@/lib/capability-scoring";
import { CAP_STATUS_LABELS, PERF_CATEGORY_LABELS } from "@/lib/capability-domain";
import { metricGap, metricTitle } from "@/lib/capability-investigation";
import { IntakePanel } from "@/components/ironiq/capability/intake-panel";
import { FindingsPanel } from "@/components/ironiq/capability/findings-panel";
import { RestorationPanel } from "@/components/ironiq/capability/restoration-panel";
import { OverviewPanel } from "@/components/ironiq/capability/overview-panel";
import { ReportPanel } from "@/components/ironiq/capability/report-panel";
import {
  ConstraintChainPanel,
  DeepDivePanel,
  DomainDashboard,
  DomainScreenPanel,
  HealthSweepPanel,
  ObservationPanel,
  PerformanceGapPanel,
  PrimaryConstraintPanel,
  SummaryPanel,
} from "@/components/ironiq/capability/investigation-panels";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/capability/$assessmentId")({
  head: () => ({
    meta: [
      { title: "Capability Investigation — IronIQ" },
      {
        name: "description",
        content:
          "Follow a known manufacturing problem from performance gap through capability screen, primary constraint and root capability gap to prioritized restoration actions.",
      },
      { property: "og:title", content: "Capability Investigation — IronIQ" },
      {
        property: "og:description",
        content: "Symptom → Evidence → Constraint → Capability Gap → Restoration Action.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CapabilityWorkspace,
});

type StepKey =
  | "dashboard"
  | "problem"
  | "performance"
  | "observe"
  | "screen"
  | "deep_dive"
  | "findings"
  | "constraint"
  | "root_gap"
  | "sweep"
  | "actions"
  | "summary"
  | "report";

const STEPS: { key: StepKey; label: string; caption: string }[] = [
  { key: "dashboard", label: "Dashboard", caption: "Domain health at a glance" },
  { key: "problem", label: "Problem", caption: "Customer-stated information" },
  { key: "performance", label: "Performance", caption: "Measurable gap" },
  { key: "observe", label: "Observe", caption: "What is actually happening" },
  { key: "screen", label: "Capability Screen", caption: "Six domains, short" },
  { key: "deep_dive", label: "Deep Dive", caption: "Targeted 0–5 scoring" },
  { key: "findings", label: "Findings", caption: "Evidence-backed, approved" },
  { key: "constraint", label: "Constraint", caption: "Chain + primary constraint" },
  { key: "root_gap", label: "Root Gap", caption: "Underlying capability gap" },
  { key: "sweep", label: "Health Sweep", caption: "Other weaknesses" },
  { key: "actions", label: "Actions", caption: "Prioritized restoration" },
  { key: "summary", label: "Summary", caption: "What to restore first" },
  { key: "report", label: "Report", caption: "Client deliverable" },
];

function CapabilityWorkspace() {
  const { assessmentId } = Route.useParams();
  const assessment = useCapAssessment(assessmentId);
  const workspace = useCapWorkspace(assessmentId);
  const investigation = useCapInvestigation(assessmentId);
  const library = useCapabilityLibrary();
  const setScore = useSetAssessmentScore(assessmentId);
  const [step, setStep] = useState<StepKey>("dashboard");

  const domains = library.data?.domains ?? [];
  const criteria = library.data?.criteria ?? [];
  const ws = workspace.data;
  const inv = investigation.data;

  const result = useMemo(
    () => computeCapability(domains, criteria, ws?.scores ?? []),
    [domains, criteria, ws?.scores],
  );

  const overall = result.overall;
  const stored = assessment.data?.overall_score;
  useEffect(() => {
    if (!assessment.data) return;
    const current = stored === null || stored === undefined ? null : Number(stored);
    if (current === overall) return;
    setScore.mutate({ overall });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overall, stored, assessment.data?.id]);

  const aiContext = useMemo(() => {
    if (!ws) return "";
    const p = ws.problem;
    const gapLines = (inv?.metrics ?? []).map((m) => {
      const g = metricGap(m);
      return `${metricTitle(m, PERF_CATEGORY_LABELS[m.category])}: current ${m.current_value ?? "?"} vs required ${
        m.required_value ?? "?"
      } ${m.unit ?? ""} (gap ${g.label})`;
    });
    return [
      `Stated problem: ${p?.stated_problem ?? "—"}`,
      `Location/process: ${p?.location_process ?? "—"}`,
      `Performance impact: ${p?.performance_impact ?? "—"}`,
      `Previous actions: ${p?.previous_actions ?? "—"}`,
      `Desired outcome: ${p?.desired_outcome ?? "—"}`,
      `Performance gaps: ${gapLines.join("; ") || "none captured"}`,
      `Observations: ${(inv?.observations ?? []).map((o) => o.observation).join("; ") || "none"}`,
      `Domain screen: ${(inv?.screens ?? [])
        .map((s) => `${domains.find((d) => d.id === s.domain_id)?.name ?? "?"}=${s.status}`)
        .join(", ") || "not screened"}`,
      `Primary constraint: ${inv?.constraint?.constraint_text ?? "not declared"}`,
      `Weak capability areas: ${result.severeCriteria
        .map((s) => `${s.domain.name}/${s.criterion.name} (${s.dimension}=${s.score})`)
        .join("; ") || "none"}`,
      `Existing findings: ${ws.findings.map((f) => f.title).join("; ") || "none"}`,
    ].join("\n");
  }, [ws, inv, domains, result.severeCriteria]);

  const dashboard = useMemo(() => {
    const scoreByDomain: Record<string, { score: number | null; confidence: string }> = {};
    for (const d of result.domains) {
      scoreByDomain[d.domain.id] = {
        score: d.score,
        confidence: d.ratedCount === 0 ? "not assessed" : `${d.ratedCount}/${d.totalCount} rated`,
      };
    }
    const findingCounts: Record<string, { total: number; critical: number }> = {};
    for (const f of ws?.findings ?? []) {
      if (!f.domain_id) continue;
      const entry = findingCounts[f.domain_id] ?? { total: 0, critical: 0 };
      entry.total += 1;
      if (f.severity === "critical" || f.classification === "primary_constraint") entry.critical += 1;
      findingCounts[f.domain_id] = entry;
    }
    const openActions: Record<string, number> = {};
    for (const a of ws?.actions ?? []) {
      const gap = (ws?.gaps ?? []).find((g) => g.id === a.root_gap_id);
      const domainId = gap?.domain_id;
      if (!domainId) continue;
      if (a.status === "complete" || a.status === "sustained") continue;
      openActions[domainId] = (openActions[domainId] ?? 0) + 1;
    }
    return { scoreByDomain, findingCounts, openActions };
  }, [result.domains, ws?.findings, ws?.actions, ws?.gaps]);

  if (assessment.isLoading || workspace.isLoading || library.isLoading || investigation.isLoading) {
    return <EmptyState message="Loading capability investigation…" />;
  }
  if (!assessment.data || !ws || !inv) {
    return <EmptyState message="Assessment not found." />;
  }

  const a = assessment.data;
  const index = STEPS.findIndex((s) => s.key === step);
  const topAction = [...ws.actions].sort((x, y) => {
    const order = { immediate: 0, high: 1, moderate: 2, monitor: 3 } as Record<string, number>;
    return (order[x.priority] ?? 9) - (order[y.priority] ?? 9);
  })[0];
  const worstGap = inv.metrics
    .map((m) => ({ m, g: metricGap(m) }))
    .filter((x) => x.g.gap !== null && !x.g.met)
    .sort((x, y) => (y.g.gap ?? 0) - (x.g.gap ?? 0))[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Manufacturing Capability Assessment · Ironclad Sustainment Solutions"
        title={a.name}
        description={
          a.scope ??
          "What capability is preventing the operation from achieving the required manufacturing performance?"
        }
        actions={
          <div className="flex items-center gap-3">
            <Tag token="primary">{CAP_STATUS_LABELS[a.status]}</Tag>
            <Button asChild variant="outline">
              <Link to="/capability">
                <ChevronLeft className="size-4" /> All assessments
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav className="no-print lg:sticky lg:top-4 lg:self-start" aria-label="Assessment progress">
          <ol className="grid gap-1">
            {STEPS.map((s, i) => (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => setStep(s.key)}
                  aria-current={step === s.key ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors",
                    step === s.key
                      ? "border-primary bg-primary/10"
                      : "border-transparent hover:border-border hover:bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-sm border font-display text-[11px] font-semibold",
                      step === s.key ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
                    )}
                  >
                    {i}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-display text-xs font-semibold uppercase tracking-widest text-foreground">
                      {s.label}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">{s.caption}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-6">
          {step === "dashboard" ? (
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-4">
                <Panel title="Primary Constraint">
                  <p className="text-sm">{inv.constraint?.constraint_text || "Not declared"}</p>
                </Panel>
                <Panel title="Performance Gap">
                  <p className="metric-value text-2xl text-critical">{worstGap ? worstGap.g.label : "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {worstGap ? metricTitle(worstGap.m, PERF_CATEGORY_LABELS[worstGap.m.category]) : "No metric"}
                  </p>
                </Panel>
                <Panel title="Assessment Confidence">
                  <p className="text-sm">{inv.constraint?.confidence ?? "Not rated"}</p>
                </Panel>
                <Panel title="Top Restoration Priority">
                  <p className="text-sm">{topAction?.recommended_action || "None yet"}</p>
                </Panel>
              </div>
              <DomainDashboard
                domains={domains}
                screens={inv.screens}
                sweep={inv.sweep}
                scoreByDomain={dashboard.scoreByDomain}
                findingCounts={dashboard.findingCounts}
                openActions={dashboard.openActions}
              />
              <OverviewPanel
                result={result}
                problem={ws.problem}
                impacts={ws.impacts}
                findings={ws.findings}
                gaps={ws.gaps}
                actions={ws.actions}
                results={ws.results}
                validations={ws.validations}
                domains={domains}
                evidence={ws.evidence}
              />
            </div>
          ) : null}

          {step === "problem" ? (
            <IntakePanel assessmentId={assessmentId} problem={ws.problem} impacts={ws.impacts} />
          ) : null}

          {step === "performance" ? (
            <PerformanceGapPanel assessmentId={assessmentId} metrics={inv.metrics} />
          ) : null}

          {step === "observe" ? (
            <ObservationPanel assessmentId={assessmentId} observations={inv.observations} domains={domains} />
          ) : null}

          {step === "screen" ? (
            <DomainScreenPanel assessmentId={assessmentId} domains={domains} screens={inv.screens} />
          ) : null}

          {step === "deep_dive" ? (
            <DeepDivePanel
              assessmentId={assessmentId}
              domains={domains}
              criteria={criteria}
              scores={ws.scores}
              screens={inv.screens}
            />
          ) : null}

          {step === "findings" || step === "root_gap" ? (
            <FindingsPanel
              assessmentId={assessmentId}
              domains={domains}
              findings={ws.findings}
              evidence={ws.evidence}
              links={ws.links}
              gaps={ws.gaps}
              aiContext={aiContext}
            />
          ) : null}

          {step === "constraint" ? (
            <div className="grid gap-6">
              <ConstraintChainPanel assessmentId={assessmentId} chain={inv.chain} />
              <PrimaryConstraintPanel
                assessmentId={assessmentId}
                constraint={inv.constraint}
                domains={domains}
                metrics={inv.metrics}
              />
            </div>
          ) : null}

          {step === "sweep" ? (
            <HealthSweepPanel
              assessmentId={assessmentId}
              domains={domains}
              sweep={inv.sweep}
              screens={inv.screens}
              constraintDomainId={inv.constraint?.domain_id ?? null}
            />
          ) : null}

          {step === "actions" ? (
            <RestorationPanel
              assessmentId={assessmentId}
              actions={ws.actions}
              gaps={ws.gaps}
              results={ws.results}
              validations={ws.validations}
              aiContext={aiContext}
            />
          ) : null}

          {step === "summary" ? (
            <SummaryPanel
              problem={ws.problem}
              metrics={inv.metrics}
              constraint={inv.constraint}
              rootGap={ws.gaps[0] ?? null}
              contributing={ws.findings
                .filter((f) => f.classification === "contributing_constraint")
                .map((f) => ({ id: f.id, title: f.title }))}
              risks={ws.findings.filter((f) => f.classification === "risk").map((f) => ({ id: f.id, title: f.title }))}
              firstAction={topAction ?? null}
              domains={domains}
            />
          ) : null}

          {step === "report" ? (
            <ReportPanel
              assessment={a}
              result={result}
              problem={ws.problem}
              impacts={ws.impacts}
              findings={ws.findings}
              gaps={ws.gaps}
              actions={ws.actions}
              results={ws.results}
              validations={ws.validations}
              domains={domains}
              aiContext={aiContext}
            />
          ) : null}

          <div className="no-print flex items-center justify-between border-t border-border pt-4">
            <Button
              variant="outline"
              disabled={index <= 0}
              onClick={() => setStep(STEPS[Math.max(0, index - 1)]!.key)}
            >
              <ChevronLeft className="size-4" /> Back
            </Button>
            <p className="text-xs text-muted-foreground">
              Step {index + 1} of {STEPS.length} · progress saves automatically
            </p>
            <Button
              disabled={index >= STEPS.length - 1}
              onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, index + 1)]!.key)}
            >
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
