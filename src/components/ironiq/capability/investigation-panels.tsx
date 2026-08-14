import { useEffect, useMemo, useState } from "react";
import { Panel, EmptyState } from "@/components/ironiq/layout-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tag } from "@/components/ironiq/badges";
import { ScoringPanel } from "./scoring-panel";
import {
  CHAIN_STEPS,
  CONSTRAINT_VALIDATION_LABELS,
  CONSTRAINT_VALIDATION_TOKEN,
  DEEP_DIVE_TRIGGERS,
  DOMAIN_SCREEN_ITEMS,
  OBSERVATION_FREQUENCIES,
  OBSERVATION_SEVERITIES,
  PERFORMANCE_CATEGORY_OPTIONS,
  SCREEN_STATUSES,
  SCREEN_STATUS_LABELS,
  SCREEN_STATUS_TOKEN,
  SWEEP_LABELS,
  SWEEP_TOKEN,
  metricGap,
  metricTitle,
  type CapChainNodeRow,
  type CapDomainScreenRow,
  type CapHealthSweepRow,
  type CapMetricRow,
  type CapObservationRow,
  type CapPrimaryConstraintRow,
  type ChainStepKey,
  type ConstraintValidation,
  type ScreenStatus,
  type SweepClassification,
} from "@/lib/capability-investigation";
import {
  useInvestigationDelete,
  useInvestigationUpsert,
  useSaveChainNode,
  useSavePrimaryConstraint,
  useSetDomainScreen,
  useSetHealthSweep,
} from "@/lib/capability-investigation-api";
import {
  CONFIDENCE_LABELS,
  EVIDENCE_TYPE_LABELS,
  PERF_CATEGORY_LABELS,
  type CapConfidence,
  type CapCriterionRow,
  type CapDomainRow,
  type CapEvidenceType,
  type CapPerfCategory,
  type CapScoreRow,
} from "@/lib/capability-domain";
import { Plus, Trash2, ArrowDown, ArrowRight } from "lucide-react";

const token = (t: string) => t as "critical";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="eyebrow">{label}</Label>
      {children}
    </div>
  );
}

function Native({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const CONFIDENCE_OPTIONS = (Object.keys(CONFIDENCE_LABELS) as CapConfidence[]).map((c) => ({
  value: c,
  label: CONFIDENCE_LABELS[c],
}));

/* ==================== STEP 2 — Performance gap ==================== */

export function PerformanceGapPanel({
  assessmentId,
  metrics,
}: {
  assessmentId: string;
  metrics: CapMetricRow[];
}) {
  const upsert = useInvestigationUpsert<Record<string, unknown>>(assessmentId, "cap_metrics", { silent: true });
  const remove = useInvestigationDelete(assessmentId, "cap_metrics", "Metric removed");
  const [category, setCategory] = useState<string>("production");

  return (
    <div className="grid gap-6">
      <Panel
        title="Define the Performance Gap"
        subtitle="Convert the stated problem into measurable performance. Performance Gap = Required − Current."
      >
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Affected performance category">
            <Native
              value={category}
              onChange={setCategory}
              options={PERFORMANCE_CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </Field>
          <Button
            onClick={() =>
              upsert.mutate({
                category: category === "other" ? "production" : category,
                other_label: category === "other" ? "Other metric" : null,
                higher_is_better: !["scrap_rework", "cost", "lead_time", "setup_time", "downtime"].includes(category),
              })
            }
          >
            <Plus className="size-4" /> Add metric
          </Button>
        </div>
      </Panel>

      {metrics.length === 0 ? (
        <EmptyState message="No performance metrics captured yet. Add the metrics the customer's problem is degrading." />
      ) : null}

      {metrics.map((m) => (
        <MetricCard
          key={m.id}
          metric={m}
          onSave={(patch) => upsert.mutate({ id: m.id, ...patch })}
          onDelete={() => remove.mutate(m.id)}
        />
      ))}
    </div>
  );
}

function MetricCard({
  metric,
  onSave,
  onDelete,
}: {
  metric: CapMetricRow;
  onSave: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(metric);
  useEffect(() => setDraft(metric), [metric]);
  const set = (patch: Partial<CapMetricRow>) => setDraft({ ...draft, ...patch });
  const commit = (patch: Partial<CapMetricRow>) => {
    set(patch);
    onSave(patch as Record<string, unknown>);
  };
  const gap = metricGap(draft);
  const title = metricTitle(draft, PERF_CATEGORY_LABELS[draft.category]);

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">{PERF_CATEGORY_LABELS[draft.category]}</p>
          <h3 className="text-base font-semibold uppercase tracking-wider">{title}</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Remove metric">
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* CURRENT → GAP → REQUIRED */}
      <div className="mt-4 grid items-center gap-2 rounded-md border border-border bg-muted/30 p-4 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <div className="text-center">
          <p className="eyebrow">Current</p>
          <p className="metric-value text-2xl">{draft.current_value ?? "—"}</p>
          <p className="text-[11px] text-muted-foreground">{draft.unit ?? ""}</p>
        </div>
        <ArrowRight className="mx-auto hidden size-4 text-muted-foreground sm:block" aria-hidden />
        <div className="text-center">
          <p className="eyebrow">Gap</p>
          <p className={`metric-value text-2xl ${gap.met ? "text-success" : "text-critical"}`}>{gap.label}</p>
          <p className="text-[11px] text-muted-foreground">
            {gap.percentOfRequired !== null ? `${gap.percentOfRequired}% of required` : "—"}
          </p>
        </div>
        <ArrowRight className="mx-auto hidden size-4 text-muted-foreground sm:block" aria-hidden />
        <div className="text-center">
          <p className="eyebrow">Required</p>
          <p className="metric-value text-2xl">{draft.required_value ?? "—"}</p>
          <p className="text-[11px] text-muted-foreground">{draft.unit ?? ""}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Field label="Metric name">
          <Input
            value={draft.metric_name ?? ""}
            onChange={(e) => set({ metric_name: e.target.value })}
            onBlur={() => onSave({ metric_name: draft.metric_name })}
            placeholder="Weekly output"
          />
        </Field>
        <Field label="Unit of measure">
          <Input
            value={draft.unit ?? ""}
            onChange={(e) => set({ unit: e.target.value })}
            onBlur={() => onSave({ unit: draft.unit })}
            placeholder="parts/week"
          />
        </Field>
        <Field label="Time period">
          <Input
            value={draft.time_period ?? ""}
            onChange={(e) => set({ time_period: e.target.value })}
            onBlur={() => onSave({ time_period: draft.time_period })}
            placeholder="Last 8 weeks"
          />
        </Field>
        <Field label="Current value">
          <Input
            type="number"
            value={draft.current_value ?? ""}
            onChange={(e) => set({ current_value: e.target.value === "" ? null : Number(e.target.value) })}
            onBlur={() => onSave({ current_value: draft.current_value })}
          />
        </Field>
        <Field label="Required / expected value">
          <Input
            type="number"
            value={draft.required_value ?? ""}
            onChange={(e) => set({ required_value: e.target.value === "" ? null : Number(e.target.value) })}
            onBlur={() => onSave({ required_value: draft.required_value })}
          />
        </Field>
        <Field label="Target value">
          <Input
            type="number"
            value={draft.target_value ?? ""}
            onChange={(e) => set({ target_value: e.target.value === "" ? null : Number(e.target.value) })}
            onBlur={() => onSave({ target_value: draft.target_value })}
          />
        </Field>
        <Field label="Data source">
          <Input
            value={draft.data_source ?? ""}
            onChange={(e) => set({ data_source: e.target.value })}
            onBlur={() => onSave({ data_source: draft.data_source })}
            placeholder="ERP production report"
          />
        </Field>
        <Field label="Confidence">
          <Native
            value={draft.confidence ?? ""}
            onChange={(v) => commit({ confidence: (v || null) as CapConfidence | null })}
            options={CONFIDENCE_OPTIONS}
            placeholder="Select confidence"
          />
        </Field>
        <Field label="Direction">
          <Native
            value={draft.higher_is_better ? "higher" : "lower"}
            onChange={(v) => commit({ higher_is_better: v === "higher" })}
            options={[
              { value: "higher", label: "Higher is better" },
              { value: "lower", label: "Lower is better" },
            ]}
          />
        </Field>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Field label="Current condition">
          <Textarea
            value={draft.current_condition ?? ""}
            onChange={(e) => set({ current_condition: e.target.value })}
            onBlur={() => onSave({ current_condition: draft.current_condition })}
            placeholder="What the operation is actually achieving today"
          />
        </Field>
        <Field label="Notes">
          <Textarea
            value={draft.notes ?? ""}
            onChange={(e) => set({ notes: e.target.value })}
            onBlur={() => onSave({ notes: draft.notes })}
          />
        </Field>
      </div>
    </section>
  );
}

/* ==================== STEP 3 — Operational observation ==================== */

export function ObservationPanel({
  assessmentId,
  observations,
  domains,
}: {
  assessmentId: string;
  observations: CapObservationRow[];
  domains: CapDomainRow[];
}) {
  const upsert = useInvestigationUpsert<Record<string, unknown>>(assessmentId, "cap_observations", { silent: true });
  const remove = useInvestigationDelete(assessmentId, "cap_observations", "Observation removed");

  return (
    <div className="grid gap-6">
      <Panel
        title="Operational Observation"
        subtitle="Document what is actually happening in the operation. Observations do not have to be assigned to a capability domain yet."
      >
        <Button onClick={() => upsert.mutate({ observation: "New observation" })}>
          <Plus className="size-4" /> Add observation
        </Button>
      </Panel>

      {observations.length === 0 ? <EmptyState message="No observations recorded yet." /> : null}

      {observations.map((o) => (
        <ObservationCard
          key={o.id}
          row={o}
          domains={domains}
          onSave={(patch) => upsert.mutate({ id: o.id, ...patch })}
          onDelete={() => remove.mutate(o.id)}
        />
      ))}
    </div>
  );
}

function ObservationCard({
  row,
  domains,
  onSave,
  onDelete,
}: {
  row: CapObservationRow;
  domains: CapDomainRow[];
  onSave: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(row);
  useEffect(() => setDraft(row), [row]);
  const set = (patch: Partial<CapObservationRow>) => setDraft({ ...draft, ...patch });
  const commit = (patch: Partial<CapObservationRow>) => {
    set(patch);
    onSave(patch as Record<string, unknown>);
  };

  return (
    <section className="panel space-y-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Field label="Observation">
            <Textarea
              value={draft.observation}
              onChange={(e) => set({ observation: e.target.value })}
              onBlur={() => onSave({ observation: draft.observation })}
              placeholder="Operators rebuild fixture setups independently on each cell"
            />
          </Field>
        </div>
        <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Remove observation">
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Area / process">
          <Input
            value={draft.area_process ?? ""}
            onChange={(e) => set({ area_process: e.target.value })}
            onBlur={() => onSave({ area_process: draft.area_process })}
          />
        </Field>
        <Field label="Machine / cell / department">
          <Input
            value={draft.machine_cell ?? ""}
            onChange={(e) => set({ machine_cell: e.target.value })}
            onBlur={() => onSave({ machine_cell: draft.machine_cell })}
          />
        </Field>
        <Field label="Capability domain (optional)">
          <Native
            value={draft.domain_id ?? ""}
            onChange={(v) => commit({ domain_id: v || null })}
            options={domains.map((d) => ({ value: d.id, label: d.name }))}
            placeholder="Unassigned"
          />
        </Field>
        <Field label="Frequency">
          <Native
            value={draft.frequency ?? ""}
            onChange={(v) => commit({ frequency: v || null })}
            options={OBSERVATION_FREQUENCIES.map((f) => ({ value: f, label: f }))}
            placeholder="Select frequency"
          />
        </Field>
        <Field label="Severity">
          <Native
            value={draft.severity ?? ""}
            onChange={(v) => commit({ severity: v || null })}
            options={OBSERVATION_SEVERITIES.map((s) => ({ value: s, label: s }))}
            placeholder="Select severity"
          />
        </Field>
        <Field label="Evidence type">
          <Native
            value={draft.evidence_type ?? ""}
            onChange={(v) => commit({ evidence_type: (v || null) as CapEvidenceType | null })}
            options={(Object.keys(EVIDENCE_TYPE_LABELS) as CapEvidenceType[]).map((e) => ({
              value: e,
              label: EVIDENCE_TYPE_LABELS[e],
            }))}
            placeholder="Select evidence"
          />
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Performance effect">
          <Textarea
            value={draft.performance_effect ?? ""}
            onChange={(e) => set({ performance_effect: e.target.value })}
            onBlur={() => onSave({ performance_effect: draft.performance_effect })}
          />
        </Field>
        <Field label="Evidence detail / attachment reference">
          <Textarea
            value={draft.evidence_note ?? ""}
            onChange={(e) => set({ evidence_note: e.target.value })}
            onBlur={() => onSave({ evidence_note: draft.evidence_note })}
          />
        </Field>
        <Field label="Assessor notes">
          <Textarea
            value={draft.assessor_notes ?? ""}
            onChange={(e) => set({ assessor_notes: e.target.value })}
            onBlur={() => onSave({ assessor_notes: draft.assessor_notes })}
          />
        </Field>
      </div>
    </section>
  );
}

/* ==================== STEP 4 — 6-domain screen ==================== */

export function DomainScreenPanel({
  assessmentId,
  domains,
  screens,
}: {
  assessmentId: string;
  domains: CapDomainRow[];
  screens: CapDomainScreenRow[];
}) {
  const save = useSetDomainScreen(assessmentId);
  const byDomain = new Map(screens.map((s) => [s.domain_id, s]));

  return (
    <div className="grid gap-4">
      <Panel
        title="6-Domain Capability Screen"
        subtitle="Keep this short. Call each domain's health, then deep dive only where the screen points."
      >
        <div className="flex flex-wrap gap-2">
          {SCREEN_STATUSES.filter((s) => s !== "not_screened").map((s) => (
            <Tag key={s} token={token(SCREEN_STATUS_TOKEN[s])}>
              {SCREEN_STATUS_LABELS[s]}
            </Tag>
          ))}
        </div>
      </Panel>

      {domains.map((d) => {
        const row = byDomain.get(d.id);
        const status: ScreenStatus = row?.status ?? "not_screened";
        const items = DOMAIN_SCREEN_ITEMS[d.code] ?? [];
        const flagged = row?.screen_items ?? [];
        return (
          <section key={d.id} className="panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow">{d.verb}</p>
                <h3 className="text-base font-semibold uppercase tracking-wider">{d.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{d.key_question}</p>
              </div>
              <Tag token={token(SCREEN_STATUS_TOKEN[status])}>{SCREEN_STATUS_LABELS[status]}</Tag>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {SCREEN_STATUSES.filter((s) => s !== "not_screened").map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => save.mutate({ domain_id: d.id, status: s })}
                  className={`rounded-sm border px-2.5 py-1 font-display text-[11px] font-semibold uppercase tracking-widest transition-colors ${
                    status === s
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"
                  }`}
                >
                  {SCREEN_STATUS_LABELS[s]}
                </button>
              ))}
            </div>

            <div className="mt-3">
              <p className="eyebrow mb-1.5">Screen items — flag anything that is not performing</p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((it) => {
                  const on = flagged.includes(it);
                  return (
                    <button
                      key={it}
                      type="button"
                      onClick={() =>
                        save.mutate({
                          domain_id: d.id,
                          screen_items: on ? flagged.filter((x) => x !== it) : [...flagged, it],
                        })
                      }
                      className={`rounded-sm border px-2 py-1 text-xs transition-colors ${
                        on
                          ? "border-critical/60 bg-critical/10 text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {it}
                    </button>
                  );
                })}
              </div>
            </div>

            <Textarea
              className="mt-3"
              defaultValue={row?.notes ?? ""}
              placeholder="Screen notes — what points toward or away from this domain"
              onBlur={(e) => save.mutate({ domain_id: d.id, notes: e.target.value })}
            />
          </section>
        );
      })}
    </div>
  );
}

/* ==================== STEP 5 — Targeted deep dive ==================== */

export function DeepDivePanel({
  assessmentId,
  domains,
  criteria,
  scores,
  screens,
}: {
  assessmentId: string;
  domains: CapDomainRow[];
  criteria: CapCriterionRow[];
  scores: CapScoreRow[];
  screens: CapDomainScreenRow[];
}) {
  const byDomain = new Map(screens.map((s) => [s.domain_id, s]));
  const targeted = domains.filter((d) => DEEP_DIVE_TRIGGERS.includes(byDomain.get(d.id)?.status ?? "not_screened"));

  return (
    <div className="grid gap-6">
      <Panel
        title="Targeted Deep Dive"
        subtitle="Only domains screened as Potential Contributor, Confirmed Contributor, Significant Risk or Not Enough Evidence are opened. Score five performance dimensions, 0–5."
      >
        {targeted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No domains are flagged for deep dive. Complete the capability screen first — healthy domains are
            deliberately left alone.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {targeted.map((d) => (
              <Tag key={d.id} token={token(SCREEN_STATUS_TOKEN[byDomain.get(d.id)!.status])}>
                {d.name} — {SCREEN_STATUS_LABELS[byDomain.get(d.id)!.status]}
              </Tag>
            ))}
          </div>
        )}
      </Panel>

      {targeted.length > 0 ? (
        <ScoringPanel
          assessmentId={assessmentId}
          domains={targeted}
          criteria={criteria.filter((c) => targeted.some((d) => d.id === c.domain_id))}
          scores={scores}
        />
      ) : null}
    </div>
  );
}

/* ==================== STEP 7 — Constraint chain ==================== */

export function ConstraintChainPanel({
  assessmentId,
  chain,
}: {
  assessmentId: string;
  chain: CapChainNodeRow[];
}) {
  const save = useSaveChainNode(assessmentId);
  const remove = useInvestigationDelete(assessmentId, "cap_chain_nodes", "Chain step cleared");
  const byKey = new Map(chain.map((c) => [c.step_key, c]));

  return (
    <Panel
      title="Constraint Chain"
      subtitle="Connect the customer problem to the capability gap and its operational consequence. Editable at any time."
    >
      <ol className="grid gap-0">
        {CHAIN_STEPS.map((step, i) => {
          const row = byKey.get(step.key);
          return (
            <li key={step.key}>
              <div className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="eyebrow">{step.label}</p>
                  {row ? (
                    <Button variant="ghost" size="sm" onClick={() => remove.mutate(row.id)} aria-label="Clear step">
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
                <Textarea
                  className="mt-1.5 min-h-14"
                  defaultValue={row?.content ?? ""}
                  placeholder={step.hint}
                  onBlur={(e) => {
                    const content = e.target.value;
                    if (!content.trim() && !row) return;
                    save.mutate({
                      id: row?.id,
                      step_key: step.key as ChainStepKey,
                      content,
                      sort_order: i,
                    });
                  }}
                />
              </div>
              {i < CHAIN_STEPS.length - 1 ? (
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

/* ==================== STEP 8 — Primary constraint ==================== */

export function PrimaryConstraintPanel({
  assessmentId,
  constraint,
  domains,
  metrics,
}: {
  assessmentId: string;
  constraint: CapPrimaryConstraintRow | null;
  domains: CapDomainRow[];
  metrics: CapMetricRow[];
}) {
  const save = useSavePrimaryConstraint(assessmentId);
  const [draft, setDraft] = useState({
    constraint_text: constraint?.constraint_text ?? "",
    supporting_evidence: constraint?.supporting_evidence ?? "",
    domain_id: constraint?.domain_id ?? "",
    metric_affected: constraint?.metric_affected ?? "",
    magnitude: constraint?.magnitude ?? "",
    confidence: constraint?.confidence ?? "",
    validation_status: (constraint?.validation_status ?? "suspected") as ConstraintValidation,
  });
  useEffect(() => {
    if (constraint)
      setDraft({
        constraint_text: constraint.constraint_text ?? "",
        supporting_evidence: constraint.supporting_evidence ?? "",
        domain_id: constraint.domain_id ?? "",
        metric_affected: constraint.metric_affected ?? "",
        magnitude: constraint.magnitude ?? "",
        confidence: constraint.confidence ?? "",
        validation_status: constraint.validation_status,
      });
  }, [constraint]);

  return (
    <Panel
      title="Primary Constraint"
      subtitle="The capability currently creating the greatest limitation to required performance. Assessor-declared only — AI cannot select it."
    >
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">Validation status</span>
          {(["suspected", "probable", "validated"] as ConstraintValidation[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setDraft({ ...draft, validation_status: s })}
              className={`rounded-sm border px-2.5 py-1 font-display text-[11px] font-semibold uppercase tracking-widest ${
                draft.validation_status === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {CONSTRAINT_VALIDATION_LABELS[s]}
            </button>
          ))}
          <Tag token={token(CONSTRAINT_VALIDATION_TOKEN[draft.validation_status])}>
            {CONSTRAINT_VALIDATION_LABELS[draft.validation_status]}
          </Tag>
        </div>

        <Field label="Primary constraint">
          <Textarea
            value={draft.constraint_text}
            onChange={(e) => setDraft({ ...draft, constraint_text: e.target.value })}
            placeholder="No controlled standardized fixturing system across machining cells"
          />
        </Field>
        <Field label="Supporting evidence">
          <Textarea
            value={draft.supporting_evidence}
            onChange={(e) => setDraft({ ...draft, supporting_evidence: e.target.value })}
            placeholder="Setup time study, observed cell-to-cell fixture variation, ERP downtime data"
          />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Capability domain">
            <Native
              value={draft.domain_id}
              onChange={(v) => setDraft({ ...draft, domain_id: v })}
              options={domains.map((d) => ({ value: d.id, label: d.name }))}
              placeholder="Select domain"
            />
          </Field>
          <Field label="Performance metric affected">
            <Native
              value={draft.metric_affected}
              onChange={(v) => setDraft({ ...draft, metric_affected: v })}
              options={metrics.map((m) => ({
                value: metricTitle(m, PERF_CATEGORY_LABELS[m.category]),
                label: metricTitle(m, PERF_CATEGORY_LABELS[m.category]),
              }))}
              placeholder="Select metric"
            />
          </Field>
          <Field label="Magnitude of impact">
            <Input
              value={draft.magnitude}
              onChange={(e) => setDraft({ ...draft, magnitude: e.target.value })}
              placeholder="≈150 parts/week of lost output"
            />
          </Field>
          <Field label="Confidence">
            <Native
              value={draft.confidence}
              onChange={(v) => setDraft({ ...draft, confidence: v })}
              options={CONFIDENCE_OPTIONS}
              placeholder="Select confidence"
            />
          </Field>
        </div>
        <div>
          <Button
            onClick={() =>
              save.mutate({
                constraint_text: draft.constraint_text,
                supporting_evidence: draft.supporting_evidence,
                domain_id: draft.domain_id || null,
                metric_affected: draft.metric_affected || null,
                magnitude: draft.magnitude || null,
                confidence: (draft.confidence || null) as CapConfidence | null,
                validation_status: draft.validation_status,
              })
            }
          >
            Declare primary constraint
          </Button>
        </div>
      </div>
    </Panel>
  );
}

/* ==================== STEP 10 — Capability health sweep ==================== */

export function HealthSweepPanel({
  assessmentId,
  domains,
  sweep,
  screens,
  constraintDomainId,
}: {
  assessmentId: string;
  domains: CapDomainRow[];
  sweep: CapHealthSweepRow[];
  screens: CapDomainScreenRow[];
  constraintDomainId: string | null;
}) {
  const save = useSetHealthSweep(assessmentId);
  const bySweep = new Map(sweep.map((s) => [s.domain_id, s]));
  const byScreen = new Map(screens.map((s) => [s.domain_id, s]));

  return (
    <div className="grid gap-4">
      <Panel
        title="Capability Health Sweep"
        subtitle="Capture weaknesses that are not causing the current problem. These stay separate from the primary constraint so unrelated issues are never blamed for it."
      >
        <p className="text-sm text-muted-foreground">
          Classify each domain, including those already screened, so future constraints are visible without
          competing with the current diagnosis.
        </p>
      </Panel>
      {domains.map((d) => {
        const row = bySweep.get(d.id);
        const cls: SweepClassification = row?.classification ?? "healthy";
        return (
          <section key={d.id} className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider">{d.name}</h3>
                <p className="text-xs text-muted-foreground">
                  Screen: {SCREEN_STATUS_LABELS[byScreen.get(d.id)?.status ?? "not_screened"]}
                  {constraintDomainId === d.id ? " · holds the primary constraint" : ""}
                </p>
              </div>
              <Tag token={token(SWEEP_TOKEN[cls])}>{SWEEP_LABELS[cls]}</Tag>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(Object.keys(SWEEP_LABELS) as SweepClassification[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => save.mutate({ domain_id: d.id, classification: c })}
                  className={`rounded-sm border px-2.5 py-1 font-display text-[11px] font-semibold uppercase tracking-widest ${
                    cls === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {SWEEP_LABELS[c]}
                </button>
              ))}
            </div>
            <Textarea
              className="mt-3"
              defaultValue={row?.note ?? ""}
              placeholder="What was seen, and why it matters later"
              onBlur={(e) => save.mutate({ domain_id: d.id, note: e.target.value })}
            />
          </section>
        );
      })}
    </div>
  );
}

/* ==================== Domain dashboard ==================== */

export function DomainDashboard({
  domains,
  screens,
  sweep,
  scoreByDomain,
  findingCounts,
  openActions,
}: {
  domains: CapDomainRow[];
  screens: CapDomainScreenRow[];
  sweep: CapHealthSweepRow[];
  scoreByDomain: Record<string, { score: number | null; confidence: string }>;
  findingCounts: Record<string, { total: number; critical: number }>;
  openActions: Record<string, number>;
}) {
  const byScreen = new Map(screens.map((s) => [s.domain_id, s]));
  const bySweep = new Map(sweep.map((s) => [s.domain_id, s]));

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {domains.map((d) => {
        const status = byScreen.get(d.id)?.status ?? "not_screened";
        const score = scoreByDomain[d.id]?.score ?? null;
        const f = findingCounts[d.id] ?? { total: 0, critical: 0 };
        return (
          <section key={d.id} className="panel p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider">{d.name}</h3>
              <Tag token={token(SCREEN_STATUS_TOKEN[status])}>{SCREEN_STATUS_LABELS[status]}</Tag>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="metric-value text-lg">{score ?? "—"}</p>
                <p className="eyebrow">Score</p>
              </div>
              <div>
                <p className="metric-value text-lg">{f.total}</p>
                <p className="eyebrow">Findings</p>
              </div>
              <div>
                <p className={`metric-value text-lg ${f.critical ? "text-critical" : ""}`}>{f.critical}</p>
                <p className="eyebrow">Critical</p>
              </div>
              <div>
                <p className="metric-value text-lg">{openActions[d.id] ?? 0}</p>
                <p className="eyebrow">Actions</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Confidence: {scoreByDomain[d.id]?.confidence ?? "not assessed"}
              {bySweep.get(d.id) ? ` · Sweep: ${SWEEP_LABELS[bySweep.get(d.id)!.classification]}` : ""}
            </p>
          </section>
        );
      })}
    </div>
  );
}

/* ==================== STEP 13 — Assessment summary ==================== */

export function SummaryPanel({
  problem,
  metrics,
  constraint,
  rootGap,
  contributing,
  risks,
  firstAction,
  domains,
}: {
  problem: { stated_problem: string | null; desired_outcome: string | null } | null;
  metrics: CapMetricRow[];
  constraint: CapPrimaryConstraintRow | null;
  rootGap: { root_gap: string; validated: boolean; operational_consequence: string | null } | null;
  contributing: { id: string; title: string }[];
  risks: { id: string; title: string }[];
  firstAction: {
    recommended_action: string;
    metric_name: string | null;
    baseline_value: number | null;
    target_value: number | null;
    unit: string | null;
    expected_outcome: string | null;
  } | null;
  domains: CapDomainRow[];
}) {
  const domainName = useMemo(
    () => domains.find((d) => d.id === constraint?.domain_id)?.name ?? "—",
    [domains, constraint],
  );

  return (
    <div className="grid gap-4">
      <Panel title="Customer Problem" subtitle="Customer-Stated Information — not validated root cause">
        <p className="text-sm text-foreground">{problem?.stated_problem || "Not captured"}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Desired outcome: {problem?.desired_outcome || "—"}
        </p>
      </Panel>

      <Panel title="Current Performance Gap">
        {metrics.length === 0 ? (
          <p className="text-sm text-muted-foreground">No metrics captured.</p>
        ) : (
          <ul className="grid gap-2">
            {metrics.map((m) => {
              const g = metricGap(m);
              return (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                  <span className="text-sm">{metricTitle(m, PERF_CATEGORY_LABELS[m.category])}</span>
                  <span className="text-sm text-muted-foreground">
                    {m.current_value ?? "—"} → {m.required_value ?? "—"} {m.unit ?? ""}
                  </span>
                  <span className={`metric-value ${g.met ? "text-success" : "text-critical"}`}>{g.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Primary Constraint" subtitle={`Capability domain: ${domainName}`}>
        {constraint?.constraint_text ? (
          <>
            <div className="mb-2">
              <Tag token={token(CONSTRAINT_VALIDATION_TOKEN[constraint.validation_status])}>
                {CONSTRAINT_VALIDATION_LABELS[constraint.validation_status]}
              </Tag>
            </div>
            <p className="text-sm">{constraint.constraint_text}</p>
            <p className="mt-2 text-xs text-muted-foreground">Magnitude: {constraint.magnitude || "—"}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Not yet declared by the assessor.</p>
        )}
      </Panel>

      <Panel title="Root Capability Gap">
        {rootGap ? (
          <>
            {!rootGap.validated ? (
              <div className="mb-2">
                <Tag token="high">Suspected Root Capability Gap — Validation Required</Tag>
              </div>
            ) : null}
            <p className="text-sm">{rootGap.root_gap}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Consequence: {rootGap.operational_consequence || "—"}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No root capability gap recorded.</p>
        )}
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Contributing Capability Gaps">
          {contributing.length === 0 ? (
            <p className="text-sm text-muted-foreground">None recorded.</p>
          ) : (
            <ul className="grid gap-1.5 text-sm">
              {contributing.map((c) => (
                <li key={c.id}>• {c.title}</li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Capability Risks">
          {risks.length === 0 ? (
            <p className="text-sm text-muted-foreground">None recorded.</p>
          ) : (
            <ul className="grid gap-1.5 text-sm">
              {risks.map((c) => (
                <li key={c.id}>• {c.title}</li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Recommended First Action" subtitle="Baseline, target and expected operational benefit">
        {firstAction ? (
          <>
            <p className="text-sm">{firstAction.recommended_action}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border p-3 text-center">
                <p className="eyebrow">Baseline</p>
                <p className="metric-value text-xl">{firstAction.baseline_value ?? "—"}</p>
              </div>
              <div className="rounded-md border border-border p-3 text-center">
                <p className="eyebrow">Target</p>
                <p className="metric-value text-xl">{firstAction.target_value ?? "—"}</p>
              </div>
              <div className="rounded-md border border-border p-3 text-center">
                <p className="eyebrow">Metric</p>
                <p className="text-sm">
                  {firstAction.metric_name ?? "—"} {firstAction.unit ?? ""}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Expected benefit: {firstAction.expected_outcome || "—"}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No prioritized restoration action yet.</p>
        )}
      </Panel>
    </div>
  );
}
