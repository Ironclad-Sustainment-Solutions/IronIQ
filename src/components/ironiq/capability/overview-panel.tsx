import { Panel, EmptyState } from "@/components/ironiq/layout-primitives";
import { Meter, ScoreChip, ClassificationBadge, PriorityBadge, ActionStatusBadge } from "./shared";
import { Tag } from "@/components/ironiq/badges";
import type {
  CapActionRow,
  CapDomainRow,
  CapEvidenceRow,
  CapFindingRow,
  CapImpactRow,
  CapProblemRow,
  CapResultRow,
  CapRootGapRow,
  CapValidationRow,
} from "@/lib/capability-domain";
import { PERF_CATEGORY_LABELS } from "@/lib/capability-domain";
import {
  formatValue,
  scoreToken,
  summarizeImprovement,
  type CapabilityResult,
} from "@/lib/capability-scoring";
import { AlertTriangle, ArrowDown, ChevronDown } from "lucide-react";
import { useState } from "react";

export function OverviewPanel({
  result,
  problem,
  impacts,
  findings,
  gaps,
  actions,
  results,
  validations,
  domains,
  evidence,
}: {
  result: CapabilityResult;
  problem: CapProblemRow | null;
  impacts: CapImpactRow[];
  findings: CapFindingRow[];
  gaps: CapRootGapRow[];
  actions: CapActionRow[];
  results: CapResultRow[];
  validations: CapValidationRow[];
  domains: CapDomainRow[];
  evidence: CapEvidenceRow[];
}) {
  const primary =
    findings.find((f) => f.classification === "primary_constraint" && f.approved) ??
    findings.find((f) => f.classification === "primary_constraint") ??
    null;
  const rootGap = gaps.find((g) => g.validated) ?? gaps[0] ?? null;
  const topAction =
    actions.find((a) => a.priority === "immediate") ?? actions.find((a) => a.priority === "high") ?? actions[0] ?? null;
  const openActions = actions.filter((a) => a.status !== "complete" && a.status !== "sustained");
  const sustained = actions.filter((a) => a.status === "sustained").length;
  const domainById = new Map(domains.map((d) => [d.id, d]));

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="panel p-5">
          <p className="eyebrow">Operational Capability Score</p>
          <div className="mt-2 flex items-end gap-2">
            <span className="font-display text-4xl font-bold tabular-nums text-foreground">
              {result.overall === null ? "—" : result.overall.toFixed(1)}
            </span>
            <span className="pb-1 text-sm text-muted-foreground">/ 5.0</span>
          </div>
          <div className="mt-3">
            <Meter value={result.overallPercent} token={scoreToken(result.overall)} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{result.completionPct}% of ratings complete</p>
        </div>
        <StatBox label="Severe Constraints" value={result.severeCount} token={result.severeCount ? "critical" : "success"} />
        <StatBox label="Open Restoration Actions" value={openActions.length} token="primary" />
        <StatBox label="Sustained Capabilities" value={sustained} token="success" />
      </div>

      {result.severeCount > 0 ? (
        <div className="rounded-md border border-critical/50 bg-critical/10 p-4">
          <p className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-widest text-critical">
            <AlertTriangle className="size-4" /> Severe constraints present — the overall score does not represent them
          </p>
          <ul className="mt-2 grid gap-1 text-sm text-foreground sm:grid-cols-2">
            {result.severeCriteria.slice(0, 8).map((s, i) => (
              <li key={`${s.criterion.id}-${s.dimension}-${i}`}>
                {s.domain.name} — {s.criterion.name} ({s.dimension}) scored {s.score}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Panel title="Capability Domains">
        <div className="grid gap-3 md:grid-cols-2">
          {result.domains.map((d) => {
            const domainFindings = findings.filter((f) => f.domain_id === d.domain.id);
            const domainPrimary = domainFindings.find((f) => f.classification === "primary_constraint");
            const domainActions = actions.filter((a) =>
              gaps.some((g) => g.id === a.root_gap_id && g.domain_id === d.domain.id),
            );
            return (
              <div key={d.domain.id} className="rounded-md border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="eyebrow">{d.domain.verb}</p>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">{d.domain.name}</h3>
                  </div>
                  <ScoreChip score={d.score} />
                </div>
                <div className="mt-3">
                  <Meter value={d.percent} token={scoreToken(d.score)} />
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Critical findings</dt>
                    <dd className="font-display text-base text-foreground">
                      {domainFindings.filter((f) => f.severity === "critical").length}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Open actions</dt>
                    <dd className="font-display text-base text-foreground">
                      {domainActions.filter((a) => a.status !== "sustained").length}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Weakest</dt>
                    <dd className="text-foreground">{d.weakest?.criterion.name ?? "—"}</dd>
                  </div>
                </dl>
                {domainPrimary ? (
                  <p className="mt-2 text-xs text-critical">Primary constraint: {domainPrimary.title}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Top Performance Constraint">
          {primary ? (
            <div className="space-y-3 text-sm">
              <ClassificationBadge value={primary.classification} />
              <p className="text-foreground">{primary.title}</p>
              <p className="text-muted-foreground">{primary.finding_text}</p>
              <div>
                <p className="eyebrow">Root capability gap</p>
                <p className="mt-1 text-foreground">
                  {rootGap ? rootGap.root_gap : "Not yet identified"}
                  {rootGap && !rootGap.validated ? " (suspected — validation required)" : ""}
                </p>
              </div>
              <div>
                <p className="eyebrow">Performance impact</p>
                <p className="mt-1 text-muted-foreground">
                  {impacts.map((i) => PERF_CATEGORY_LABELS[i.category]).join(", ") || "—"}
                </p>
              </div>
              {topAction ? (
                <div>
                  <p className="eyebrow">Recommended restoration action</p>
                  <p className="mt-1 text-foreground">{topAction.recommended_action}</p>
                  <p className="mt-1 text-muted-foreground">{topAction.expected_outcome}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState message="No primary constraint identified yet." />
          )}
        </Panel>

        <Panel title="Restoration Progress & Measured Improvement">
          {actions.length === 0 ? (
            <EmptyState message="No restoration actions yet." />
          ) : (
            <div className="space-y-3">
              {actions.map((a) => {
                const imp = summarizeImprovement(a, results.filter((r) => r.action_id === a.id));
                const val = validations.filter((v) => v.action_id === a.id).at(-1);
                return (
                  <div key={a.id} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-40 flex-1 text-foreground">{a.recommended_action}</span>
                      <PriorityBadge value={a.priority} />
                      <ActionStatusBadge value={a.status} />
                    </div>
                    <p className="mt-1 font-display text-xs tracking-wide text-muted-foreground">
                      {a.metric_name ?? "Metric"}: {formatValue(imp.baseline, a.unit)} → {formatValue(imp.target, a.unit)} →{" "}
                      {formatValue(imp.actual, a.unit)}
                      {imp.targetAchieved ? " • target achieved" : ""}
                    </p>
                    {val ? <p className="mt-1 text-xs text-muted-foreground">Sustainment: {val.result.replaceAll("_", " ")}</p> : null}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <CapabilityMap
        problem={problem}
        impacts={impacts}
        primary={primary}
        rootGap={rootGap}
        action={topAction}
        results={results}
        validations={validations}
        evidence={evidence}
        domainName={rootGap?.domain_id ? (domainById.get(rootGap.domain_id)?.name ?? null) : null}
        domainQuestion={rootGap?.domain_id ? (domainById.get(rootGap.domain_id)?.key_question ?? null) : null}
      />
    </div>
  );
}

function StatBox({ label, value, token }: { label: string; value: number; token: string }) {
  return (
    <div className="panel p-5">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-display text-4xl font-bold tabular-nums text-foreground">{value}</p>
      <div className="mt-3">
        <Meter value={100} token={token} />
      </div>
    </div>
  );
}

function CapabilityMap({
  problem,
  impacts,
  primary,
  rootGap,
  action,
  results,
  validations,
  evidence,
  domainName,
  domainQuestion,
}: {
  problem: CapProblemRow | null;
  impacts: CapImpactRow[];
  primary: CapFindingRow | null;
  rootGap: CapRootGapRow | null;
  action: CapActionRow | null;
  results: CapResultRow[];
  validations: CapValidationRow[];
  evidence: CapEvidenceRow[];
  domainName: string | null;
  domainQuestion: string | null;
}) {
  const [openNode, setOpenNode] = useState<string | null>(null);
  const imp = action ? summarizeImprovement(action, results.filter((r) => r.action_id === action.id)) : null;
  const val = action ? validations.filter((v) => v.action_id === action.id).at(-1) : null;

  const nodes: {
    label: string;
    value: string;
    detail?: string;
    token?: string;
    facts: { label: string; value: string }[];
  }[] = [
    {
      label: "Customer Problem",
      value: problem?.stated_problem || "Not captured",
      detail: problem?.location_process ?? undefined,
      facts: [
        { label: "Greatest impact", value: problem?.q_greatest_impact || "—" },
        { label: "Where / when visible", value: problem?.q_where_when || "—" },
        { label: "Previously tried", value: problem?.previous_actions || problem?.q_tried || "—" },
        { label: "Desired outcome", value: problem?.desired_outcome || problem?.q_if_resolved || "—" },
      ],
    },
    {
      label: "Performance Impact",
      value: impacts.map((i) => PERF_CATEGORY_LABELS[i.category]).join(", ") || "Not identified",
      detail: problem?.performance_impact ?? undefined,
      facts: impacts.map((i) => ({
        label: PERF_CATEGORY_LABELS[i.category],
        value: `${i.current_condition || "—"}${
          i.metric_name
            ? ` • ${i.metric_name}: ${formatValue(i.current_value, i.unit)} → target ${formatValue(i.target_value, i.unit)}`
            : ""
        }${i.data_source ? ` • source: ${i.data_source}` : ""}`,
      })),
    },
    {
      label: "Capability Domain",
      value: domainName ?? "Not assigned",
      facts: [{ label: "Domain question", value: domainQuestion ?? "—" }],
    },
    {
      label: "Constraint",
      value: primary?.title ?? "Not identified",
      token: primary ? "critical" : undefined,
      facts: primary
        ? [
            { label: "Finding", value: primary.finding_text || "—" },
            { label: "Dimension", value: primary.dimension ?? "—" },
            { label: "Severity / confidence", value: `${primary.severity} • ${primary.confidence}` },
            { label: "Source", value: primary.source.replaceAll("_", " ") },
            ...evidence
              .filter((e) => e.finding_id === primary.id)
              .map((e) => ({
                label: `Evidence — ${e.evidence_type.replaceAll("_", " ")}`,
                value: `${e.description || "—"}${e.source ? ` (${e.source})` : ""}`,
              })),
          ]
        : [],
    },
    {
      label: "Root Capability Gap",
      value: rootGap?.root_gap ?? "Not identified",
      detail: rootGap && !rootGap.validated ? "Suspected — validation required" : rootGap ? "Validated" : undefined,
      facts: rootGap
        ? [
            { label: "Observed problem", value: rootGap.observed_problem || "—" },
            { label: "Immediate cause", value: rootGap.immediate_cause || "—" },
            { label: "Contributing factors", value: rootGap.contributing_factors || "—" },
            { label: "Operational consequence", value: rootGap.operational_consequence || "—" },
          ]
        : [],
    },
    {
      label: "Restoration Action",
      value: action?.recommended_action ?? "Not defined",
      detail: action?.expected_outcome ?? undefined,
      facts: action
        ? [
            { label: "Responsible party", value: action.responsible_party || "—" },
            { label: "Target date", value: action.target_date || "—" },
            { label: "Priority / status", value: `${action.priority} • ${action.status.replaceAll("_", " ")}` },
            { label: "Validation method", value: action.validation_method || "—" },
          ]
        : [],
    },
    {
      label: "Measured Result",
      value: imp
        ? `${formatValue(imp.baseline, action?.unit)} → ${formatValue(imp.target, action?.unit)} → ${formatValue(imp.actual, action?.unit)}`
        : "Not measured",
      facts: imp
        ? [
            { label: "Absolute improvement", value: formatValue(imp.absolute, action?.unit) },
            { label: "Percent improvement", value: imp.percent === null ? "—" : `${imp.percent}%` },
            { label: "Target achieved", value: imp.targetAchieved ? "Yes" : "Not yet" },
          ]
        : [],
    },
    {
      label: "Sustained Capability",
      value: val ? val.result.replaceAll("_", " ") : "Not validated",
      facts: val
        ? [
            { label: "Checkpoint", value: `${val.interval_days} day` },
            { label: "Validated on", value: val.validated_on || "—" },
            { label: "Notes", value: val.notes || "—" },
          ]
        : [],
    },
  ];

  return (
    <Panel title="Capability Map" subtitle="Identify → Validate → Restore → Measure → Sustain">
      <ol className="grid gap-1">
        {nodes.map((n, i) => {
          const open = openNode === n.label;
          return (
            <li key={n.label}>
              <div className="rounded-md border border-border">
                <button
                  type="button"
                  onClick={() => setOpenNode(open ? null : n.label)}
                  className="flex w-full flex-wrap items-center gap-2 p-3 text-left hover:bg-muted/40"
                  aria-expanded={open}
                >
                  <Tag token={(n.token as "critical") ?? "primary"}>{n.label}</Tag>
                  <span className="min-w-40 flex-1 text-sm text-foreground">{n.value}</span>
                  <ChevronDown
                    className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                {n.detail ? <p className="px-3 pb-3 text-xs text-muted-foreground">{n.detail}</p> : null}
                {open ? (
                  <dl className="grid gap-2 border-t border-border p-3 text-xs sm:grid-cols-2">
                    {n.facts.length === 0 ? (
                      <p className="text-muted-foreground">No supporting detail recorded yet.</p>
                    ) : (
                      n.facts.map((f, idx) => (
                        <div key={`${f.label}-${idx}`}>
                          <dt className="eyebrow">{f.label}</dt>
                          <dd className="mt-0.5 text-foreground">{f.value}</dd>
                        </div>
                      ))
                    )}
                  </dl>
                ) : null}
              </div>
              {i < nodes.length - 1 ? (
                <div className="flex justify-center py-1">
                  <ArrowDown className="size-4 text-muted-foreground" aria-hidden />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

