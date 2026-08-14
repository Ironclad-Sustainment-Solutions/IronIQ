/**
 * Field view: assessment setup, the client-reported (unvalidated) starting
 * picture, and Day 1/2/3 guidance with live progress from what has been
 * captured so far.
 */

import { Panel } from "@/components/ironiq/layout-primitives";
import { Badge } from "@/components/ui/badge";
import { AutoField } from "@/components/ironiq/field/review-parts";
import { InlineNote, NumberField, QuickSelect, StatTile } from "@/components/ironiq/field/ops-primitives";
import {
  DAY_FOCUS,
  DEFAULT_OPERATIONAL_QUESTION,
  delayMinutes,
  formatMinutes,
  type BaselineMetricRow,
  type CauseNodeRow,
  type DelayRow,
  type EvidenceItemRow,
  type PilotRow,
  type ProductionEventRow,
} from "@/lib/field-ops";
import { cn } from "@/lib/utils";

export interface SetupValues {
  assessment_name: string | null;
  objective: string | null;
  primary_operational_question: string | null;
  assessment_lead: string | null;
  team_members: string | null;
  start_date: string | null;
  target_completion_date: string | null;
  est_impact_notes: string | null;
  est_lost_hours_week: number | null;
  known_machines: string | null;
  known_parts: string | null;
  known_smes: string | null;
  day_focus: string | null;
}

export function FieldViewTab({
  setup,
  locked,
  set,
  events,
  delays,
  causes,
  evidence,
  metrics,
  pilots,
}: {
  setup: SetupValues;
  locked: boolean;
  set: (values: Partial<SetupValues>) => void;
  events: ProductionEventRow[];
  delays: DelayRow[];
  causes: CauseNodeRow[];
  evidence: EvidenceItemRow[];
  metrics: BaselineMetricRow[];
  pilots: PilotRow[];
}) {
  const totalLost = delays.reduce((sum, d) => sum + delayMinutes(d), 0);
  const validatedCauses = causes.filter((c) => c.validation_status === "Validated").length;
  const dominant = causes.find((c) => c.is_dominant);
  const activeDay = setup.day_focus ?? "day1";

  const progress: Record<string, boolean[]> = {
    day1: [
      Boolean(setup.known_parts),
      Boolean(setup.known_machines),
      events.length > 0,
      delays.length > 0,
      metrics.length > 0,
    ],
    day2: [
      delays.length > 1,
      causes.length > 0,
      evidence.length > 0,
      causes.some((c) => (c.domain_codes ?? []).length > 0),
      validatedCauses > 0,
    ],
    day3: [
      metrics.some((m) => m.data_class === "Validated" || m.data_class === "Observed"),
      delays.length > 0,
      Boolean(dominant),
      pilots.length > 0,
      pilots.some((p) => Boolean(p.affected_metric)),
      pilots.some((p) => Boolean(p.proposed_change)),
    ],
  };

  return (
    <div className="space-y-4">
      <Panel title="Live field snapshot" subtitle="What has been captured so far">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Events" value={String(events.length)} />
          <StatTile label="Delays" value={String(delays.length)} />
          <StatTile label="Time lost" value={formatMinutes(totalLost || null)} />
          <StatTile label="Evidence" value={String(evidence.length)} />
          <StatTile label="Validated causes" value={String(validatedCauses)} />
          <StatTile label="Baseline metrics" value={String(metrics.length)} />
        </div>
        {dominant ? (
          <p className="mt-3 rounded-sm border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground">
            Dominant capability gap: {dominant.description || "described in the causal chain"}
          </p>
        ) : (
          <div className="mt-3">
            <InlineNote>No dominant capability gap marked yet.</InlineNote>
          </div>
        )}
      </Panel>

      <Panel title="Assessment setup" subtitle="Who is on site, what is being answered and by when">
        <div className="grid gap-3 sm:grid-cols-2">
          <AutoField
            label="Assessment name"
            value={setup.assessment_name}
            disabled={locked}
            onCommit={(assessment_name) => set({ assessment_name })}
          />
          <AutoField
            label="Assessment lead"
            value={setup.assessment_lead}
            disabled={locked}
            onCommit={(assessment_lead) => set({ assessment_lead })}
          />
          <AutoField
            label="ISS team members"
            value={setup.team_members}
            disabled={locked}
            onCommit={(team_members) => set({ team_members })}
          />
          <AutoField
            label="Start date"
            value={setup.start_date}
            disabled={locked}
            placeholder="YYYY-MM-DD"
            onCommit={(start_date) => set({ start_date: start_date || null })}
          />
          <AutoField
            label="Target completion date"
            value={setup.target_completion_date}
            disabled={locked}
            placeholder="YYYY-MM-DD"
            onCommit={(target_completion_date) =>
              set({ target_completion_date: target_completion_date || null })
            }
          />
        </div>
        <div className="mt-3 grid gap-3">
          <AutoField
            label="Objective"
            value={setup.objective}
            multiline
            disabled={locked}
            onCommit={(objective) => set({ objective })}
          />
          <AutoField
            label="Primary operational question"
            value={setup.primary_operational_question ?? DEFAULT_OPERATIONAL_QUESTION}
            multiline
            rows={4}
            disabled={locked}
            onCommit={(primary_operational_question) => set({ primary_operational_question })}
          />
        </div>
      </Panel>

      <Panel
        title="Client-reported starting picture"
        subtitle="Unvalidated until Ironclad observes it directly"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label="Estimated lost hours per week"
            value={setup.est_lost_hours_week}
            suffix="hrs"
            disabled={locked}
            onCommit={(est_lost_hours_week) => set({ est_lost_hours_week })}
          />
          <AutoField
            label="Known machines"
            value={setup.known_machines}
            disabled={locked}
            onCommit={(known_machines) => set({ known_machines })}
          />
          <AutoField
            label="Known parts"
            value={setup.known_parts}
            disabled={locked}
            onCommit={(known_parts) => set({ known_parts })}
          />
          <AutoField
            label="Known subject-matter experts"
            value={setup.known_smes}
            disabled={locked}
            onCommit={(known_smes) => set({ known_smes })}
          />
        </div>
        <div className="mt-3">
          <AutoField
            label="Estimated impact (as reported)"
            value={setup.est_impact_notes}
            multiline
            disabled={locked}
            onCommit={(est_impact_notes) => set({ est_impact_notes })}
          />
        </div>
        <div className="mt-3">
          <InlineNote>
            Everything on this panel is client reported. It is carried into the report labelled as
            unvalidated until Ironclad measures it.
          </InlineNote>
        </div>
      </Panel>

      <Panel title="Field day focus" subtitle="Guidance for where the assessment is today">
        <QuickSelect
          options={DAY_FOCUS.map((d) => d.label)}
          value={DAY_FOCUS.find((d) => d.key === activeDay)?.label ?? null}
          disabled={locked}
          columns={3}
          onChange={(label) =>
            set({ day_focus: DAY_FOCUS.find((d) => d.label === label)?.key ?? "day1" })
          }
        />
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {DAY_FOCUS.map((day) => {
            const marks = progress[day.key] ?? [];
            const done = marks.filter(Boolean).length;
            const isActive = day.key === activeDay;
            return (
              <div
                key={day.key}
                className={cn(
                  "rounded-sm border p-4",
                  isActive ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-xs font-semibold uppercase tracking-widest text-foreground">
                    {day.label}
                  </p>
                  <Badge variant={done === marks.length ? "default" : "outline"} className="text-[10px]">
                    {done}/{marks.length}
                  </Badge>
                </div>
                <p className="eyebrow mt-3">Focus</p>
                <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                  {day.focus.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <p className="eyebrow mt-3">Completion indicators</p>
                <ul className="mt-1 grid gap-1 text-xs">
                  {day.indicators.map((ind, i) => (
                    <li
                      key={ind}
                      className={cn(marks[i] ? "text-foreground" : "text-muted-foreground")}
                    >
                      {marks[i] ? "✓" : "○"} {ind}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
