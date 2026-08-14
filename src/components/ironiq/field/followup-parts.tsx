/**
 * Field Capability Assessment → Findings Review meeting.
 *
 * These panels keep the field visit honest: qualitative area statuses instead
 * of a score, explicit evidence classification, a short list of preliminary
 * findings, and a client validation pass during the follow-up meeting.
 */

import { useMemo, useState } from "react";
import { ChevronDown, Loader2, Plus, Sparkles } from "lucide-react";
import { Panel, EmptyState } from "@/components/ironiq/layout-primitives";
import { Button } from "@/components/ui/button";
import { AutoField, EntryCard, TagPicker } from "./review-parts";
import { Chip } from "./capture-parts";
import { cn } from "@/lib/utils";
import {
  EVIDENCE_CLASSES,
  PRODUCTION_IMPACT_OPTIONS,
  type FieldCapabilityGap,
  type FieldCaptureObservationRow,
} from "@/lib/field-domains";
import {
  CLIENT_STATE_TEXT,
  CLIENT_VALIDATION_STATES,
  FIELD_AREAS,
  FIELD_STATUSES,
  MEETING_AGENDA,
  NEXT_PATHS,
  OBSERVATION_SEVERITY,
  OPP_COMPLEXITY,
  OPP_CONFIDENCE,
  OPP_REVENUE,
  OPP_SERVICES,
  OPP_STAGES,
  PATH_QUESTIONS,
  STATUS_BG,
  STATUS_HELP,
  STATUS_TEXT,
  areaTitle,
  type AreaBaseline,
  type FieldStatus,
  type PathRecommendation,
} from "@/lib/field-followup";

/* --------------------------- 1. field overview ---------------------------- */

export function FieldOverviewTab({
  baselines,
  observations,
  locked,
  onAddObservation,
  onUpdateObservation,
  onDeleteObservation,
  onPromote,
  hasGap,
}: {
  baselines: AreaBaseline[];
  observations: FieldCaptureObservationRow[];
  locked: boolean;
  onAddObservation: (areaCode: string) => void;
  onUpdateObservation: (id: string, values: Record<string, unknown>) => void;
  onDeleteObservation: (id: string) => void;
  onPromote: (row: FieldCaptureObservationRow) => void;
  hasGap: (observationId: string) => boolean;
}) {
  const [open, setOpen] = useState<string | null>(FIELD_AREAS[0]!.code);

  return (
    <div className="space-y-3">
      <Panel
        title="Field overview"
        subtitle="Twelve areas walked during the visit. Record only what was actually seen — coverage is reported honestly."
      >
        <p className="text-xs text-muted-foreground">
          A field visit produces an operational overview, not a capability score. Each area is
          reported as one of four qualitative statuses.
        </p>
      </Panel>

      {baselines.map((b) => {
        const rows = observations.filter((o) => o.focus_area === b.area.code);
        const expanded = open === b.area.code;
        return (
          <section key={b.area.code} className="panel overflow-hidden">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : b.area.code)}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 text-left"
            >
              <div className="min-w-0">
                <p className="eyebrow">Area {b.area.number}</p>
                <h2 className="truncate text-sm font-semibold uppercase tracking-wider text-foreground">
                  {b.area.title}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">{b.area.prompt}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <p className={cn("text-xs font-semibold uppercase tracking-wide", STATUS_TEXT[b.status])}>
                    {b.status}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {rows.length} observation{rows.length === 1 ? "" : "s"}
                  </p>
                </div>
                <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden />
              </div>
            </button>

            {expanded ? (
              <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
                {rows.length === 0 ? (
                  <EmptyState message="Nothing recorded in this area yet." />
                ) : (
                  rows.map((o, i) => (
                    <EntryCard
                      key={o.id}
                      title={`Observation ${i + 1}${o.machine ? ` — ${o.machine}` : ""}`}
                      disabled={locked}
                      onDelete={() => onDeleteObservation(o.id)}
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <AutoField
                          label="Area / department"
                          value={o.area}
                          disabled={locked}
                          onCommit={(v) => onUpdateObservation(o.id, { area: v })}
                        />
                        <AutoField
                          label="Machine / cell"
                          value={o.machine}
                          disabled={locked}
                          onCommit={(v) => onUpdateObservation(o.id, { machine: v })}
                        />
                      </div>
                      <AutoField
                        label="What was observed"
                        value={o.observed_condition}
                        multiline
                        rows={2}
                        disabled={locked}
                        onCommit={(v) => onUpdateObservation(o.id, { observed_condition: v })}
                      />
                      <AutoField
                        label="Operational impact observed"
                        value={o.operational_impact}
                        multiline
                        rows={2}
                        disabled={locked}
                        onCommit={(v) => onUpdateObservation(o.id, { operational_impact: v })}
                      />
                      <AutoField
                        label="Capability that appears constrained"
                        value={o.constrained_capability}
                        multiline
                        rows={2}
                        disabled={locked}
                        onCommit={(v) => onUpdateObservation(o.id, { constrained_capability: v })}
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <TagPicker
                          label="Evidence classification"
                          single
                          options={EVIDENCE_CLASSES}
                          selected={o.evidence_class ? [o.evidence_class] : []}
                          disabled={locked}
                          onChange={(v) => onUpdateObservation(o.id, { evidence_class: v[0] ?? "Observed" })}
                        />
                        <TagPicker
                          label="Severity"
                          single
                          options={OBSERVATION_SEVERITY}
                          selected={o.severity ? [o.severity] : []}
                          disabled={locked}
                          onChange={(v) => onUpdateObservation(o.id, { severity: v[0] ?? null })}
                        />
                      </div>
                      <AutoField
                        label="Potential Ironclad support (internal)"
                        value={o.ironclad_support}
                        disabled={locked}
                        onCommit={(v) => onUpdateObservation(o.id, { ironclad_support: v })}
                      />
                      <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={o.requires_validation}
                          disabled={locked}
                          onChange={(e) => onUpdateObservation(o.id, { requires_validation: e.target.checked })}
                        />
                        Requires validation
                      </label>
                      {hasGap(o.id) ? (
                        <Chip label="Promoted to finding" className="text-success" />
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={locked}
                          onClick={() => onPromote(o)}
                        >
                          Promote to preliminary finding
                        </Button>
                      )}
                    </EntryCard>
                  ))
                )}
                <Button size="sm" disabled={locked} onClick={() => onAddObservation(b.area.code)}>
                  <Plus className="size-4" aria-hidden /> Add observation
                </Button>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------- 2. preliminary findings ------------------------ */

export function PreliminaryFindingsTab({
  findings,
  allGaps,
  locked,
  onUpdate,
  onAdd,
  onDelete,
  aiBusyId,
  onSuggestQuestions,
}: {
  findings: FieldCapabilityGap[];
  allGaps: FieldCapabilityGap[];
  locked: boolean;
  onUpdate: (id: string, values: Partial<FieldCapabilityGap>) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  aiBusyId: string | null;
  onSuggestQuestions: (gap: FieldCapabilityGap) => void;
}) {
  const selected = findings.length;
  return (
    <div className="space-y-4">
      <Panel
        title="Preliminary findings"
        subtitle="Select the three to five findings that matter most. Everything else stays as a recorded observation."
        actions={
          <Button size="sm" disabled={locked} onClick={onAdd}>
            <Plus className="size-4" aria-hidden /> Add finding
          </Button>
        }
      >
        <p
          className={cn(
            "text-xs",
            selected > 5 || selected < 3 ? "text-high" : "text-muted-foreground",
          )}
        >
          {selected} of 3–5 findings selected. {allGaps.length - selected} other gap(s) recorded but not
          presented as findings.
        </p>
      </Panel>

      {allGaps.length === 0 ? (
        <EmptyState message="No gaps recorded yet. Promote an observation from the field overview." />
      ) : (
        allGaps.map((g, i) => (
          <EntryCard
            key={g.id}
            title={`${g.is_top_finding ? "Finding" : "Gap"} ${i + 1}${g.title ? ` — ${g.title}` : ""}`}
            disabled={locked}
            onDelete={() => onDelete(g.id)}
          >
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <input
                type="checkbox"
                checked={g.is_top_finding}
                disabled={locked}
                onChange={(e) => onUpdate(g.id, { is_top_finding: e.target.checked })}
              />
              Present as a preliminary finding
            </label>
            <AutoField label="Finding title" value={g.title} disabled={locked} onCommit={(v) => onUpdate(g.id, { title: v })} />
            <TagPicker
              label="Field area"
              single
              options={FIELD_AREAS.map((a) => a.title)}
              selected={g.focus_area ? [areaTitle(g.focus_area)] : []}
              disabled={locked}
              onChange={(v) =>
                onUpdate(g.id, {
                  focus_area: FIELD_AREAS.find((a) => a.title === v[0])?.code ?? null,
                })
              }
            />
            <AutoField
              label="1. What was observed"
              value={g.observed_condition}
              multiline
              rows={2}
              disabled={locked}
              onCommit={(v) => onUpdate(g.id, { observed_condition: v })}
            />
            <AutoField
              label="2. Operational impact"
              value={g.operational_impact_text}
              multiline
              rows={2}
              disabled={locked}
              onCommit={(v) => onUpdate(g.id, { operational_impact_text: v })}
            />
            <AutoField
              label="3. Preliminary constraint (not a confirmed root cause)"
              value={g.preliminary_constraint}
              multiline
              rows={2}
              disabled={locked}
              onCommit={(v) => onUpdate(g.id, { preliminary_constraint: v })}
            />
            <AutoField
              label="4. Validation required"
              value={g.validation_needed}
              multiline
              rows={2}
              disabled={locked}
              onCommit={(v) => onUpdate(g.id, { validation_needed: v })}
            />
            <AutoField
              label="5. Potential Ironclad support"
              value={g.ironclad_support}
              multiline
              rows={2}
              disabled={locked}
              onCommit={(v) => onUpdate(g.id, { ironclad_support: v })}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <TagPicker
                label="6. Evidence classification"
                single
                options={EVIDENCE_CLASSES}
                selected={g.evidence_class ? [g.evidence_class] : []}
                disabled={locked}
                onChange={(v) => onUpdate(g.id, { evidence_class: v[0] ?? null })}
              />
              <TagPicker
                label="Production impact"
                options={PRODUCTION_IMPACT_OPTIONS}
                selected={g.impact_tags ?? []}
                disabled={locked}
                onChange={(impact_tags) => onUpdate(g.id, { impact_tags })}
              />
            </div>

            <div className="rounded-sm border border-dashed border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="eyebrow">Validation questions for the client</p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={locked || aiBusyId === g.id}
                  onClick={() => onSuggestQuestions(g)}
                >
                  {aiBusyId === g.id ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="size-4" aria-hidden />
                  )}
                  Draft questions
                </Button>
              </div>
              <div className="mt-3 grid gap-3">
                <AutoField
                  label="Questions (one per line)"
                  value={(g.validation_questions ?? []).join("\n")}
                  multiline
                  rows={4}
                  disabled={locked}
                  onCommit={(v) =>
                    onUpdate(g.id, {
                      validation_questions: v.split("\n").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
                <AutoField
                  label="Data / access needed to validate (one per line)"
                  value={(g.data_requirements ?? []).join("\n")}
                  multiline
                  rows={3}
                  disabled={locked}
                  onCommit={(v) =>
                    onUpdate(g.id, {
                      data_requirements: v.split("\n").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
              </div>
            </div>
          </EntryCard>
        ))
      )}
    </div>
  );
}

/* ---------------------- 3. preliminary field baseline --------------------- */

export function StatusBaselineTab({
  baselines,
  locked,
  onSetStatus,
}: {
  baselines: AreaBaseline[];
  locked: boolean;
  onSetStatus: (areaCode: string, status: FieldStatus | null) => void;
}) {
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const b of baselines) m[b.status] = (m[b.status] ?? 0) + 1;
    return m;
  }, [baselines]);

  return (
    <div className="space-y-4">
      <Panel
        title="Preliminary field baseline"
        subtitle="Qualitative visual only — a walkthrough cannot support a capability score"
      >
        <div className="grid gap-2 sm:grid-cols-4">
          {FIELD_STATUSES.map((s) => (
            <div key={s} className="rounded-sm border border-border p-3">
              <span className={cn("block h-1.5 w-8 rounded-sm", STATUS_BG[s])} aria-hidden />
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-foreground">{s}</p>
              <p className="metric text-2xl font-semibold text-foreground">{counts[s] ?? 0}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{STATUS_HELP[s]}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="By area" subtitle="Suggested from what was recorded. The assessor has the final say.">
        <div className="grid gap-3">
          {baselines.map((b) => (
            <div key={b.area.code} className="rounded-sm border border-border p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {b.area.number}. {b.area.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.observations} observation(s) · {b.gaps} gap(s) ·{" "}
                    {b.requiresValidation} requiring validation
                  </p>
                </div>
                <span className={cn("shrink-0 text-xs font-semibold uppercase", STATUS_TEXT[b.status])}>
                  {b.status}
                </span>
              </div>
              <div className="mt-2">
                <TagPicker
                  options={[...FIELD_STATUSES]}
                  single
                  selected={[b.status]}
                  disabled={locked}
                  onChange={(v) => onSetStatus(b.area.code, (v[0] as FieldStatus | undefined) ?? null)}
                />
              </div>
              {b.overridden ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Assessor override — suggested from evidence: {b.suggested}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* -------------------------- 4. recommended next step ---------------------- */

export function NextStepPanel({
  answers,
  recommendation,
  chosen,
  locked,
  onAnswer,
  onChoose,
}: {
  answers: Record<string, boolean | null>;
  recommendation: PathRecommendation;
  chosen: string | null;
  locked: boolean;
  onAnswer: (column: string, value: boolean | null) => void;
  onChoose: (path: string | null) => void;
}) {
  return (
    <Panel
      title="Recommended next step"
      subtitle="Ironclad only recommends a deeper assessment when the evidence justifies it."
    >
      <div className="grid gap-2">
        {PATH_QUESTIONS.map((q) => {
          const v = answers[q.column] ?? null;
          return (
            <div
              key={q.column}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-sm border border-border p-3"
            >
              <p className="min-w-0 text-sm text-foreground">{q.label}</p>
              <div className="flex shrink-0 gap-1.5">
                {[true, false].map((opt) => (
                  <button
                    key={String(opt)}
                    type="button"
                    disabled={locked}
                    onClick={() => onAnswer(q.column, v === opt ? null : opt)}
                    className={cn(
                      "min-h-9 rounded-sm border px-3 text-xs font-semibold uppercase tracking-wide",
                      v === opt
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {opt ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-sm border border-dashed border-border p-3">
        <p className="eyebrow">Suggested path</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{recommendation.path ?? "Not yet determined"}</p>
        <p className="mt-1 text-xs text-muted-foreground">{recommendation.rationale}</p>
      </div>

      <div className="mt-3">
        <TagPicker
          label="Recorded recommendation"
          single
          options={[...NEXT_PATHS]}
          selected={chosen ? [chosen] : []}
          disabled={locked}
          onChange={(v) => onChoose(v[0] ?? null)}
        />
      </div>
    </Panel>
  );
}

/* ------------------------ 5. findings review meeting ---------------------- */

export function ReviewMeetingTab({
  assessment,
  findings,
  locked,
  set,
  onUpdateFinding,
}: {
  assessment: Record<string, any>;
  findings: FieldCapabilityGap[];
  locked: boolean;
  set: (values: Record<string, unknown>) => void;
  onUpdateFinding: (id: string, values: Partial<FieldCapabilityGap>) => void;
}) {
  return (
    <div className="space-y-4">
      <Panel title="Meeting details" subtitle="Findings review with the client — validation, not a sales pitch">
        <div className="grid gap-3 sm:grid-cols-2">
          <AutoField
            label="Meeting date"
            value={assessment['review_meeting_date']}
            disabled={locked}
            placeholder="YYYY-MM-DD"
            onCommit={(v) => set({ review_meeting_date: v || null })}
          />
          <AutoField
            label="Attendees"
            value={assessment['review_attendees']}
            disabled={locked}
            onCommit={(v) => set({ review_attendees: v })}
          />
        </div>
      </Panel>

      <Panel title="Agenda" subtitle="Roughly 60 minutes">
        <ol className="grid gap-2">
          {MEETING_AGENDA.map((a, i) => (
            <li key={a.title} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-sm border border-border p-3">
              <span className="metric text-sm font-semibold text-muted-foreground">{i + 1}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  {a.title} <span className="text-xs font-normal text-muted-foreground">· {a.minutes} min</span>
                </span>
                <span className="block text-xs text-muted-foreground">{a.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel
        title="Finding-by-finding validation"
        subtitle="Capture the client's response to each preliminary finding in their words"
      >
        {findings.length === 0 ? (
          <EmptyState message="Select preliminary findings first." />
        ) : (
          <div className="grid gap-4">
            {findings.map((g, i) => (
              <div key={g.id} className="rounded-sm border border-border p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="eyebrow">Finding {i + 1}</p>
                    <p className="text-sm font-semibold text-foreground">
                      {g.title || g.observed_condition || "Untitled finding"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{g.operational_impact_text}</p>
                  </div>
                  {g.client_status ? (
                    <Chip label={g.client_status} className={CLIENT_STATE_TEXT[g.client_status]} />
                  ) : null}
                </div>

                {(g.validation_questions ?? []).length > 0 ? (
                  <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                    {g.validation_questions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-3 grid gap-3">
                  <TagPicker
                    label="Client response"
                    single
                    options={[...CLIENT_VALIDATION_STATES]}
                    selected={g.client_status ? [g.client_status] : []}
                    disabled={locked}
                    onChange={(v) => onUpdateFinding(g.id, { client_status: v[0] ?? null })}
                  />
                  <AutoField
                    label="Client comments"
                    value={g.client_comments}
                    multiline
                    rows={3}
                    disabled={locked}
                    onCommit={(v) => onUpdateFinding(g.id, { client_comments: v })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="What we need to learn next" subtitle="Data, access and interviews required to validate">
        <div className="grid gap-3">
          <AutoField
            label="New information provided by the client"
            value={assessment['meeting_new_info']}
            multiline
            disabled={locked}
            onCommit={(v) => set({ meeting_new_info: v })}
          />
          <AutoField
            label="New gaps identified in the meeting"
            value={assessment['meeting_new_gaps']}
            multiline
            disabled={locked}
            onCommit={(v) => set({ meeting_new_gaps: v })}
          />
          <AutoField
            label="Data the client agreed to provide"
            value={assessment['meeting_data_promised']}
            multiline
            disabled={locked}
            onCommit={(v) => set({ meeting_data_promised: v })}
          />
          <AutoField
            label="Scope adjustments discussed"
            value={assessment['meeting_scope']}
            multiline
            disabled={locked}
            onCommit={(v) => set({ meeting_scope: v })}
          />
          <AutoField
            label="Other projects or priorities raised"
            value={assessment['meeting_projects']}
            multiline
            disabled={locked}
            onCommit={(v) => set({ meeting_projects: v })}
          />
        </div>
      </Panel>

      <Panel title="Meeting outcome" subtitle="Decision, owner and target date">
        <div className="grid gap-3">
          <TagPicker
            label="Decision"
            single
            options={[...NEXT_PATHS, "Client Reviewing Internally"]}
            selected={assessment['meeting_decision'] ? [assessment['meeting_decision']] : []}
            disabled={locked}
            onChange={(v) => set({ meeting_decision: v[0] ?? null })}
          />
          <AutoField
            label="Agreed next action"
            value={assessment['meeting_next_action']}
            multiline
            disabled={locked}
            onCommit={(v) => set({ meeting_next_action: v })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <AutoField
              label="Owner"
              value={assessment['meeting_owner']}
              disabled={locked}
              onCommit={(v) => set({ meeting_owner: v })}
            />
            <AutoField
              label="Target date"
              value={assessment['meeting_target_date']}
              placeholder="YYYY-MM-DD"
              disabled={locked}
              onCommit={(v) => set({ meeting_target_date: v || null })}
            />
          </div>
          <AutoField
            label="Meeting notes"
            value={assessment['review_notes']}
            multiline
            rows={5}
            disabled={locked}
            onCommit={(v) => set({ review_notes: v })}
          />
        </div>
      </Panel>
    </div>
  );
}

/* --------------------- 6. internal opportunity tracking ------------------- */

export function OpportunityTab({
  findings,
  locked,
  onUpdate,
}: {
  findings: FieldCapabilityGap[];
  locked: boolean;
  onUpdate: (id: string, values: Partial<FieldCapabilityGap>) => void;
}) {
  return (
    <Panel
      title="Ironclad opportunity view"
      subtitle="Internal only — never included in any client-facing summary or report"
    >
      {findings.length === 0 ? (
        <EmptyState message="Select preliminary findings first." />
      ) : (
        <div className="grid gap-4">
          {findings.map((g, i) => (
            <div key={g.id} className="rounded-sm border border-border p-4">
              <p className="eyebrow">Finding {i + 1}</p>
              <p className="text-sm font-semibold text-foreground">
                {g.title || g.observed_condition || "Untitled finding"}
              </p>
              <div className="mt-3 grid gap-3">
                <TagPicker
                  label="Ironclad service line"
                  single
                  options={OPP_SERVICES}
                  selected={g.opp_service ? [g.opp_service] : []}
                  disabled={locked}
                  onChange={(v) => onUpdate(g.id, { opp_service: v[0] ?? null })}
                />
                <AutoField
                  label="Estimated scope"
                  value={g.opp_scope}
                  multiline
                  rows={2}
                  disabled={locked}
                  onCommit={(v) => onUpdate(g.id, { opp_scope: v })}
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <TagPicker
                    label="Complexity"
                    single
                    options={OPP_COMPLEXITY}
                    selected={g.opp_complexity ? [g.opp_complexity] : []}
                    disabled={locked}
                    onChange={(v) => onUpdate(g.id, { opp_complexity: v[0] ?? null })}
                  />
                  <TagPicker
                    label="Revenue potential"
                    single
                    options={OPP_REVENUE}
                    selected={g.opp_revenue ? [g.opp_revenue] : []}
                    disabled={locked}
                    onChange={(v) => onUpdate(g.id, { opp_revenue: v[0] ?? null })}
                  />
                  <TagPicker
                    label="Confidence"
                    single
                    options={OPP_CONFIDENCE}
                    selected={g.opp_confidence ? [g.opp_confidence] : []}
                    disabled={locked}
                    onChange={(v) => onUpdate(g.id, { opp_confidence: v[0] ?? null })}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <AutoField
                    label="Resources required"
                    value={g.opp_resources}
                    disabled={locked}
                    onCommit={(v) => onUpdate(g.id, { opp_resources: v })}
                  />
                  <AutoField
                    label="Partner required"
                    value={g.opp_partner}
                    disabled={locked}
                    onCommit={(v) => onUpdate(g.id, { opp_partner: v })}
                  />
                </div>
                <TagPicker
                  label="Stage"
                  single
                  options={OPP_STAGES}
                  selected={g.opp_stage ? [g.opp_stage] : []}
                  disabled={locked}
                  onChange={(v) => onUpdate(g.id, { opp_stage: v[0] ?? null })}
                />
                <AutoField
                  label="Next internal action"
                  value={g.opp_next_action}
                  disabled={locked}
                  onCommit={(v) => onUpdate(g.id, { opp_next_action: v })}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
