/**
 * Saved machine-change windows. Before/after values are computed from
 * capture events, not typed into part_outcome_cards.
 *
 * The events relation is owned by the sibling ingest PR. This module
 * queries it when present and does not create or alter that table.
 *
 * Expected ingest shape (do not invent a second events schema here):
 *   public.shop_machine_events (
 *     machine_id UUID,
 *     part_id UUID,
 *     occurred_at TIMESTAMPTZ,
 *     event_type TEXT,          -- CYCLE | SETUP_CANDIDATE | …
 *     cycle_time_s NUMERIC,
 *     idle_s NUMERIC,           -- SETUP_CANDIDATE idle duration
 *     cycles NUMERIC
 *   )
 */

export const MACHINE_CAPTURE_EVENTS_TABLE = "shop_machine_events";

export const CYCLE_EVENT_TYPE = "CYCLE";
export const SETUP_CANDIDATE_EVENT_TYPE = "SETUP_CANDIDATE";

export interface ShopMachineImprovement {
  id: string;
  organization_id: string;
  facility_id: string;
  plant_id: string;
  part_id: string;
  machine_id: string;
  title: string;
  changed_at: string;
  window_before_hours: number;
  window_after_hours: number;
  created_at: string;
  updated_at: string;
  part_number: string | null;
  machine_label: string | null;
}

export interface MachineCaptureEvent {
  occurred_at: string;
  machine_id: string;
  part_id: string | null;
  event_type: string;
  cycle_time_s: number | null;
  idle_s: number | null;
  cycles: number | null;
}

export interface ImprovementWindowBounds {
  beforeStart: Date;
  changedAt: Date;
  afterEnd: Date;
}

export interface EventWindowSummary {
  cycles: number;
  cycle_time_s: number;
  setup_candidate_idle_s: number;
  event_count: number;
}

export type ImprovementEventQuery = Pick<
  ShopMachineImprovement,
  | "machine_id"
  | "part_id"
  | "changed_at"
  | "window_before_hours"
  | "window_after_hours"
>;

export type ImprovementComparison =
  | {
      status: "computed";
      before: EventWindowSummary;
      after: EventWindowSummary;
    }
  | {
      status: "cannot_compute";
      reason: "events_unavailable" | "empty_window";
      detail: string;
    };

export function improvementWindows(change: {
  changed_at: string | Date;
  window_before_hours: number;
  window_after_hours: number;
}): ImprovementWindowBounds {
  const changedAt = toDate(change.changed_at);
  const beforeMs = change.window_before_hours * 60 * 60 * 1000;
  const afterMs = change.window_after_hours * 60 * 60 * 1000;
  return {
    beforeStart: new Date(changedAt.getTime() - beforeMs),
    changedAt,
    afterEnd: new Date(changedAt.getTime() + afterMs),
  };
}

export function eventInHalfOpenWindow(
  occurredAt: string | Date,
  start: Date,
  end: Date,
): boolean {
  const t = toDate(occurredAt).getTime();
  return t >= start.getTime() && t < end.getTime();
}

export function eventsForImprovementWindow(
  events: MachineCaptureEvent[],
  change: ImprovementEventQuery,
  side: "before" | "after",
): MachineCaptureEvent[] {
  const { beforeStart, changedAt, afterEnd } = improvementWindows(change);
  const start = side === "before" ? beforeStart : changedAt;
  const end = side === "before" ? changedAt : afterEnd;
  return events.filter(
    (event) =>
      event.machine_id === change.machine_id &&
      event.part_id === change.part_id &&
      eventInHalfOpenWindow(event.occurred_at, start, end),
  );
}

export function summarizeCaptureEvents(
  events: MachineCaptureEvent[],
): EventWindowSummary {
  let cycles = 0;
  let cycleTimeS = 0;
  let setupIdleS = 0;
  for (const event of events) {
    const type = event.event_type.trim().toUpperCase();
    if (type === SETUP_CANDIDATE_EVENT_TYPE) {
      setupIdleS += event.idle_s ?? event.cycle_time_s ?? 0;
      continue;
    }
    if (type === CYCLE_EVENT_TYPE || type === "") {
      cycles += event.cycles ?? 1;
      cycleTimeS += event.cycle_time_s ?? 0;
    }
  }
  return {
    cycles: round3(cycles),
    cycle_time_s: round3(cycleTimeS),
    setup_candidate_idle_s: round3(setupIdleS),
    event_count: events.length,
  };
}

export function computeImprovementBeforeAfter(
  change: ImprovementEventQuery,
  events: MachineCaptureEvent[] | null,
): ImprovementComparison {
  if (events == null) {
    return {
      status: "cannot_compute",
      reason: "events_unavailable",
      detail:
        "Machine events are not available yet, so before/after cannot be computed.",
    };
  }
  const beforeEvents = eventsForImprovementWindow(events, change, "before");
  const afterEvents = eventsForImprovementWindow(events, change, "after");
  if (beforeEvents.length === 0 || afterEvents.length === 0) {
    return {
      status: "cannot_compute",
      reason: "empty_window",
      detail:
        "No machine events in the before and/or after window, so before/after cannot be computed yet.",
    };
  }
  return {
    status: "computed",
    before: summarizeCaptureEvents(beforeEvents),
    after: summarizeCaptureEvents(afterEvents),
  };
}

function toDate(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("changed_at is not a valid timestamp");
  }
  return date;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
