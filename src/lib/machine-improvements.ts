/**
 * Saved machine-change windows. Before/after values are computed from
 * iss.machine_event.v1 rows on public.shop_machine_events (ingest PR #73).
 * This module does not create or alter that table.
 *
 * Ingest contract (source of truth):
 *   time:            ts_utc
 *   event_type:      state_change | cycle_end | alarm | heartbeat
 *   cycles:          event_type = cycle_end (cycle_seq identifies the cycle)
 *   cycle time:      cycle_time_s
 *   idle:            idle_since_prev_cycle_s
 *   setup idle:      gap_class = SETUP_CANDIDATE (not an event_type)
 *   machine_id:      shop_machines.asset_id (text, not the UUID PK)
 *   part_id:         text part number
 *   program_name:    program on the event
 */

export const MACHINE_CAPTURE_EVENTS_TABLE = "shop_machine_events";

export const CYCLE_END_EVENT_TYPE = "cycle_end";
export const SETUP_CANDIDATE_GAP_CLASS = "SETUP_CANDIDATE";

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
  machine_asset_id: string | null;
  machine_label: string | null;
}

/** iss.machine_event.v1 row fields used to compute before/after. */
export interface MachineCaptureEvent {
  ts_utc: string;
  machine_id: string;
  part_id: string | null;
  program_name: string | null;
  event_type: string;
  cycle_seq: number | null;
  cycle_time_s: number | null;
  idle_since_prev_cycle_s: number | null;
  gap_class: string | null;
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

/** Match events by ingest spec ids: machine_id = asset_id, part_id = part number. */
export type ImprovementEventQuery = {
  machine_id: string;
  part_id: string;
  changed_at: string | Date;
  window_before_hours: number;
  window_after_hours: number;
};

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
  tsUtc: string | Date,
  start: Date,
  end: Date,
): boolean {
  const t = toDate(tsUtc).getTime();
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
      eventInHalfOpenWindow(event.ts_utc, start, end),
  );
}

export function summarizeCaptureEvents(
  events: MachineCaptureEvent[],
): EventWindowSummary {
  let cycles = 0;
  let cycleTimeS = 0;
  let setupIdleS = 0;
  const seenSeq = new Set<number>();
  for (const event of events) {
    if (event.gap_class === SETUP_CANDIDATE_GAP_CLASS) {
      setupIdleS += event.idle_since_prev_cycle_s ?? 0;
    }
    if (event.event_type !== CYCLE_END_EVENT_TYPE) continue;
    if (event.cycle_seq == null) {
      cycles += 1;
    } else if (!seenSeq.has(event.cycle_seq)) {
      seenSeq.add(event.cycle_seq);
      cycles += 1;
    }
    cycleTimeS += event.cycle_time_s ?? 0;
  }
  return {
    cycles: round3(cycles),
    cycle_time_s: round3(cycleTimeS),
    setup_candidate_idle_s: round3(setupIdleS),
    event_count: events.length,
  };
}

export function eventQueryFromImprovement(
  improvement: ShopMachineImprovement,
): ImprovementEventQuery | null {
  if (!improvement.machine_asset_id || !improvement.part_number) return null;
  return {
    machine_id: improvement.machine_asset_id,
    part_id: improvement.part_number,
    changed_at: improvement.changed_at,
    window_before_hours: improvement.window_before_hours,
    window_after_hours: improvement.window_after_hours,
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
