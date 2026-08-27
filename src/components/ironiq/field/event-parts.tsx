/**
 * Production Event Capture: start an event in one tap, mark changeover
 * milestones as they happen, log delays with a live timer and attach evidence.
 */

import { useMemo, useState } from "react";
import { Clock, Plus, Timer } from "lucide-react";
import { Panel, EmptyState } from "@/components/ironiq/layout-primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AutoField, EntryCard } from "@/components/ironiq/field/review-parts";
import {
  BigAction,
  InlineNote,
  LiveTimer,
  NumberField,
  QuickSelect,
  StatTile,
} from "@/components/ironiq/field/ops-primitives";
import {
  CHANGEOVER_MARKS,
  EVENT_TYPES,
  EVIDENCE_TYPES,
  LOSS_CATEGORIES,
  computeDurations,
  delayMinutes,
  formatMinutes,
  lossByCategory,
  type DelayRow,
  type EventMarkRow,
  type EvidenceItemRow,
  type ProductionEventRow,
} from "@/lib/field-ops";
import { cn } from "@/lib/utils";

const timeLabel = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export function EventsTab({
  events,
  marks,
  delays,
  evidence,
  locked,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onMark,
  onClearMark,
  onAddDelay,
  onUpdateDelay,
  onDeleteDelay,
  onAddEvidence,
  onUpdateEvidence,
  onDeleteEvidence,
}: {
  events: ProductionEventRow[];
  marks: EventMarkRow[];
  delays: DelayRow[];
  evidence: EvidenceItemRow[];
  locked: boolean;
  onAddEvent: (values: Partial<ProductionEventRow>) => void;
  onUpdateEvent: (id: string, values: Partial<ProductionEventRow>) => void;
  onDeleteEvent: (id: string) => void;
  onMark: (eventId: string, markCode: string, existing?: EventMarkRow) => void;
  onClearMark: (markId: string) => void;
  onAddDelay: (values: Partial<DelayRow>) => void;
  onUpdateDelay: (id: string, values: Partial<DelayRow>) => void;
  onDeleteDelay: (id: string) => void;
  onAddEvidence: (values: Partial<EvidenceItemRow>) => void;
  onUpdateEvidence: (id: string, values: Partial<EvidenceItemRow>) => void;
  onDeleteEvidence: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    events[0]?.id ?? null,
  );
  const active = events.find((e) => e.id === selectedId) ?? events[0] ?? null;
  const activeMarks = useMemo(
    () => marks.filter((m) => m.event_id === active?.id),
    [marks, active?.id],
  );
  const durations = useMemo(() => computeDurations(activeMarks), [activeMarks]);
  const eventDelays = delays.filter((d) => d.event_id === active?.id);
  const losses = useMemo(() => lossByCategory(delays), [delays]);

  return (
    <div className="space-y-4">
      <Panel
        title="Start a production event"
        subtitle="One tap starts the record and the clock. Everything else can be filled in later."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {EVENT_TYPES.map((type) => (
            <BigAction
              key={type}
              label={type}
              hint="Starts now"
              disabled={locked}
              icon={<Timer className="size-4" aria-hidden />}
              onClick={() =>
                onAddEvent({
                  event_type: type,
                  occurred_at: new Date().toISOString(),
                  timer_started_at: new Date().toISOString(),
                })
              }
            />
          ))}
        </div>
      </Panel>

      {events.length === 0 ? (
        <EmptyState message="No production events captured yet. Start one above when a changeover or interruption begins." />
      ) : (
        <>
          <Panel
            title="Captured events"
            subtitle="Select an event to time it and record delays"
          >
            <div className="grid gap-2">
              {events.map((e) => {
                const eMarks = marks.filter((m) => m.event_id === e.id);
                const d = computeDurations(eMarks);
                const lost = delays
                  .filter((x) => x.event_id === e.id)
                  .reduce((sum, x) => sum + delayMinutes(x), 0);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setSelectedId(e.id)}
                    className={cn(
                      "rounded-sm border px-3 py-3 text-left transition-colors",
                      active?.id === e.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/50",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase tracking-wider"
                      >
                        {e.event_type}
                      </Badge>
                      <span className="text-sm font-semibold text-foreground">
                        {[e.machine, e.part].filter(Boolean).join(" · ") ||
                          "Unassigned machine"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(e.occurred_at).toLocaleString()} · Total{" "}
                      {formatMinutes(d.totalChangeover)} · Delays{" "}
                      {formatMinutes(lost || null)} · {eMarks.length} timestamps
                    </p>
                  </button>
                );
              })}
            </div>
          </Panel>

          {active ? (
            <>
              <Panel
                title="Event details"
                subtitle="Machine, part and setup context"
                actions={
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={locked}
                    onClick={() => {
                      onDeleteEvent(active.id);
                      setSelectedId(null);
                    }}
                  >
                    Delete event
                  </Button>
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <AutoField
                    label="Machine"
                    value={active.machine}
                    disabled={locked}
                    onCommit={(machine) =>
                      onUpdateEvent(active.id, { machine })
                    }
                  />
                  <AutoField
                    label="Part number"
                    value={active.part}
                    disabled={locked}
                    onCommit={(part) => onUpdateEvent(active.id, { part })}
                  />
                  <AutoField
                    label="Operator"
                    value={active.operator}
                    disabled={locked}
                    onCommit={(operator) =>
                      onUpdateEvent(active.id, { operator })
                    }
                  />
                  <AutoField
                    label="Shift"
                    value={active.shift}
                    disabled={locked}
                    onCommit={(shift) => onUpdateEvent(active.id, { shift })}
                  />
                  <AutoField
                    label="Previous job"
                    value={active.previous_job}
                    disabled={locked}
                    onCommit={(previous_job) =>
                      onUpdateEvent(active.id, { previous_job })
                    }
                  />
                  <AutoField
                    label="Incoming job"
                    value={active.incoming_job}
                    disabled={locked}
                    onCommit={(incoming_job) =>
                      onUpdateEvent(active.id, { incoming_job })
                    }
                  />
                  <AutoField
                    label="Fixture"
                    value={active.fixture}
                    disabled={locked}
                    onCommit={(fixture) =>
                      onUpdateEvent(active.id, { fixture })
                    }
                  />
                  <AutoField
                    label="Program"
                    value={active.program}
                    disabled={locked}
                    onCommit={(program) =>
                      onUpdateEvent(active.id, { program })
                    }
                  />
                  <AutoField
                    label="Tooling package"
                    value={active.tooling_package}
                    disabled={locked}
                    onCommit={(tooling_package) =>
                      onUpdateEvent(active.id, { tooling_package })
                    }
                  />
                  <AutoField
                    label="Material / casting"
                    value={active.material}
                    disabled={locked}
                    onCommit={(material) =>
                      onUpdateEvent(active.id, { material })
                    }
                  />
                  <AutoField
                    label="Work order"
                    value={active.work_order}
                    disabled={locked}
                    onCommit={(work_order) =>
                      onUpdateEvent(active.id, { work_order })
                    }
                  />
                </div>
                <div className="mt-3">
                  <AutoField
                    label="Notes (dictation friendly)"
                    value={active.notes}
                    multiline
                    disabled={locked}
                    placeholder="Say or type exactly what you saw. Facts only."
                    onCommit={(notes) => onUpdateEvent(active.id, { notes })}
                  />
                </div>
              </Panel>

              <Panel
                title="Changeover timer"
                subtitle="Tap a milestone the moment it happens. Tap again to correct it — the original time is kept."
              >
                <div className="mb-3 flex items-center gap-3">
                  <Clock className="size-4 text-muted-foreground" aria-hidden />
                  <span className="eyebrow">Running since first mark</span>
                  <LiveTimer
                    startedAt={
                      activeMarks[0]?.marked_at ?? active.timer_started_at
                    }
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CHANGEOVER_MARKS.map((m) => {
                    const existing = activeMarks.find(
                      (x) => x.mark_code === m.code,
                    );
                    return (
                      <div
                        key={m.code}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-sm border px-3 py-2",
                          existing
                            ? "border-primary/50 bg-primary/10"
                            : "border-border bg-card",
                        )}
                      >
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => onMark(active.id, m.code, existing)}
                          className="min-h-11 flex-1 text-left text-sm font-medium text-foreground disabled:opacity-50"
                        >
                          {m.label}
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {timeLabel(existing?.marked_at)}
                          </span>
                        </button>
                        {existing ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={locked}
                            aria-label={`Clear ${m.label}`}
                            onClick={() => onClearMark(existing.id)}
                          >
                            Clear
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  <StatTile
                    label="Total changeover"
                    value={formatMinutes(durations.totalChangeover)}
                  />
                  <StatTile
                    label="Setup time"
                    value={formatMinutes(durations.setupTime)}
                  />
                  <StatTile
                    label="To first cycle"
                    value={formatMinutes(durations.timeToFirstCycle)}
                  />
                  <StatTile
                    label="First-piece qualification"
                    value={formatMinutes(durations.firstPieceQualification)}
                  />
                  <StatTile
                    label="To production release"
                    value={formatMinutes(durations.timeToProductionRelease)}
                  />
                </div>
                {activeMarks.some((m) => (m.edit_history ?? []).length > 0) ? (
                  <div className="mt-3">
                    <InlineNote>
                      Corrected timestamps:{" "}
                      {activeMarks
                        .filter((m) => (m.edit_history ?? []).length > 0)
                        .map(
                          (m) =>
                            `${CHANGEOVER_MARKS.find((c) => c.code === m.mark_code)?.label ?? m.mark_code} (was ${timeLabel(m.original_at)})`,
                        )
                        .join("; ")}
                    </InlineNote>
                  </div>
                ) : null}
              </Panel>

              <DelayPanel
                delays={eventDelays}
                locked={locked}
                context={{ machine: active.machine, part: active.part }}
                onAdd={(values) =>
                  onAddDelay({ ...values, event_id: active.id })
                }
                onUpdate={onUpdateDelay}
                onDelete={onDeleteDelay}
              />

              <EvidencePanel
                evidence={evidence.filter((e) => e.event_id === active.id)}
                locked={locked}
                onAdd={(values) =>
                  onAddEvidence({
                    ...values,
                    event_id: active.id,
                    machine: active.machine,
                    part: active.part,
                  })
                }
                onUpdate={onUpdateEvidence}
                onDelete={onDeleteEvidence}
              />
            </>
          ) : null}

          <Panel
            title="Loss summary"
            subtitle="Where time is being lost across every captured event"
          >
            {losses.length === 0 ? (
              <EmptyState message="No delays captured yet." />
            ) : (
              <div className="grid gap-2">
                {losses.map((l) => (
                  <div
                    key={l.category}
                    className="flex items-center justify-between gap-3 rounded-sm border border-border px-3 py-2"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {l.category}
                    </span>
                    <span className="font-mono text-sm text-muted-foreground">
                      {formatMinutes(l.minutes)} · {l.count} event
                      {l.count === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

export function DelayPanel({
  delays,
  locked,
  context,
  onAdd,
  onUpdate,
  onDelete,
  title = "Delays and lost time",
}: {
  delays: DelayRow[];
  locked: boolean;
  context?: { machine?: string | null; part?: string | null };
  onAdd: (values: Partial<DelayRow>) => void;
  onUpdate: (id: string, values: Partial<DelayRow>) => void;
  onDelete: (id: string) => void;
  title?: string;
}) {
  return (
    <Panel
      title={title}
      subtitle="Tap a category to start the clock, then stop it when production resumes."
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {LOSS_CATEGORIES.map((cat) => (
          <BigAction
            key={cat}
            label={cat}
            hint="Start delay now"
            disabled={locked}
            onClick={() =>
              onAdd({
                loss_category: cat,
                started_at: new Date().toISOString(),
                machine: context?.machine ?? null,
                part: context?.part ?? null,
              })
            }
          />
        ))}
      </div>

      <div className="mt-4 grid gap-3">
        {delays.length === 0 ? (
          <EmptyState message="No delays captured for this event." />
        ) : (
          delays.map((d) => {
            const running = Boolean(d.started_at && !d.ended_at);
            return (
              <EntryCard
                key={d.id}
                title={`${d.loss_category} · ${formatMinutes(delayMinutes(d) || null)}`}
                disabled={locked}
                onDelete={() => onDelete(d.id)}
              >
                <div className="flex flex-wrap items-center gap-3">
                  {running ? (
                    <>
                      <LiveTimer startedAt={d.started_at} />
                      <Button
                        size="sm"
                        disabled={locked}
                        onClick={() => {
                          const ended = new Date().toISOString();
                          const minutes =
                            Math.round(
                              ((new Date(ended).getTime() -
                                new Date(d.started_at as string).getTime()) /
                                60000) *
                                10,
                            ) / 10;
                          onUpdate(d.id, {
                            ended_at: ended,
                            minutes_lost: minutes,
                          });
                        }}
                      >
                        Stop delay
                      </Button>
                    </>
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground">
                      {timeLabel(d.started_at)} → {timeLabel(d.ended_at)}
                    </span>
                  )}
                </div>
                <QuickSelect
                  label="Loss category"
                  options={LOSS_CATEGORIES}
                  value={d.loss_category}
                  disabled={locked}
                  columns={3}
                  onChange={(loss_category) =>
                    onUpdate(d.id, { loss_category })
                  }
                />
                <NumberField
                  label="Minutes lost"
                  value={d.minutes_lost}
                  suffix="min"
                  disabled={locked}
                  onCommit={(minutes_lost) => onUpdate(d.id, { minutes_lost })}
                />
                <AutoField
                  label="What happened (facts only)"
                  value={d.what_happened}
                  multiline
                  disabled={locked}
                  onCommit={(what_happened) =>
                    onUpdate(d.id, { what_happened })
                  }
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <AutoField
                    label="Person involved"
                    value={d.person_involved}
                    disabled={locked}
                    onCommit={(person_involved) =>
                      onUpdate(d.id, { person_involved })
                    }
                  />
                  <AutoField
                    label="Machine"
                    value={d.machine}
                    disabled={locked}
                    onCommit={(machine) => onUpdate(d.id, { machine })}
                  />
                </div>
              </EntryCard>
            );
          })
        )}
      </div>
    </Panel>
  );
}

export function EvidencePanel({
  evidence,
  locked,
  onAdd,
  onUpdate,
  onDelete,
  title = "Evidence",
}: {
  evidence: EvidenceItemRow[];
  locked: boolean;
  onAdd: (values: Partial<EvidenceItemRow>) => void;
  onUpdate: (id: string, values: Partial<EvidenceItemRow>) => void;
  onDelete: (id: string) => void;
  title?: string;
}) {
  return (
    <Panel
      title={title}
      subtitle="Log what supports the observation. Photos and files can also be attached in the field walk."
      actions={
        <Button
          size="sm"
          variant="outline"
          disabled={locked}
          onClick={() => onAdd({ evidence_type: "ISS observation" })}
        >
          <Plus className="size-4" aria-hidden /> Add evidence
        </Button>
      }
    >
      {evidence.length === 0 ? (
        <EmptyState message="No evidence logged yet." />
      ) : (
        <div className="grid gap-3">
          {evidence.map((e) => (
            <EntryCard
              key={e.id}
              title={e.evidence_type}
              disabled={locked}
              onDelete={() => onDelete(e.id)}
            >
              <QuickSelect
                label="Evidence type"
                options={EVIDENCE_TYPES}
                value={e.evidence_type}
                disabled={locked}
                columns={3}
                onChange={(evidence_type) => onUpdate(e.id, { evidence_type })}
              />
              <AutoField
                label="Description"
                value={e.description}
                multiline
                disabled={locked}
                onCommit={(description) => onUpdate(e.id, { description })}
              />
              <AutoField
                label="Captured by"
                value={e.captured_by}
                disabled={locked}
                onCommit={(captured_by) => onUpdate(e.id, { captured_by })}
              />
            </EntryCard>
          ))}
        </div>
      )}
    </Panel>
  );
}
