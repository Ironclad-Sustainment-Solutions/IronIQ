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
 *   first-piece idle: gap_class = FIRST_PIECE_CANDIDATE
 *   machine_id:      shop_machines.asset_id (text, not the UUID PK)
 *   part_id:         text part number
 *   program_name:    program on the event
 */

export const MACHINE_CAPTURE_EVENTS_TABLE = "shop_machine_events";

export const CYCLE_END_EVENT_TYPE = "cycle_end";
export const SETUP_CANDIDATE_GAP_CLASS = "SETUP_CANDIDATE";
export const FIRST_PIECE_CANDIDATE_GAP_CLASS = "FIRST_PIECE_CANDIDATE";
export const EMPTY_WINDOW_MESSAGE = "No events in this window yet.";

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
  plant_name: string | null;
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
  first_piece_candidate_idle_s: number;
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

export type WindowResult =
  { status: "ok"; summary: EventWindowSummary } | { status: "empty" };

export type HoursDeltaLabel = "recovered" | "worse" | "unchanged";

export type ImprovementComparison =
  | {
      status: "unavailable";
      reason: "events_unavailable";
      detail: string;
    }
  | {
      status: "report";
      before: WindowResult;
      after: WindowResult;
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
  let firstPieceIdleS = 0;
  const seenSeq = new Set<number>();
  for (const event of events) {
    // A raw NUMERIC column from Postgres comes back through node-pg as a
    // string, not a JS number (node-pg only returns real/double
    // precision columns as native numbers, specifically to avoid silent
    // float-precision loss on NUMERIC/DECIMAL). MachineCaptureEvent's
    // type claims `number | null` for these fields, but that's only true
    // once something coerces them -- callers passing rows straight from
    // a query would otherwise hit `0 += "100"` here, which is STRING
    // CONCATENATION in JS (not numeric addition) once either side is a
    // string, silently producing a garbage-large "number" after enough
    // iterations rather than an error. Number(...) here makes this
    // function correct regardless of what shape of value actually
    // arrives, not just what the type annotation promises.
    const idle = Number(event.idle_since_prev_cycle_s ?? 0);
    if (event.gap_class === SETUP_CANDIDATE_GAP_CLASS) {
      setupIdleS += idle;
    } else if (event.gap_class === FIRST_PIECE_CANDIDATE_GAP_CLASS) {
      firstPieceIdleS += idle;
    }
    if (event.event_type !== CYCLE_END_EVENT_TYPE) continue;
    if (event.cycle_seq == null) {
      cycles += 1;
    } else if (!seenSeq.has(event.cycle_seq)) {
      seenSeq.add(event.cycle_seq);
      cycles += 1;
    }
    cycleTimeS += Number(event.cycle_time_s ?? 0);
  }
  return {
    cycles: round3(cycles),
    cycle_time_s: round3(cycleTimeS),
    setup_candidate_idle_s: round3(setupIdleS),
    first_piece_candidate_idle_s: round3(firstPieceIdleS),
    event_count: events.length,
  };
}

export function secondsToHours(seconds: number): number {
  return round3(seconds / 3600);
}

/** (sum cycle_time_s + SETUP_CANDIDATE idle) / 3600 */
export function hoursToMakePart(summary: EventWindowSummary): number {
  return secondsToHours(summary.cycle_time_s + summary.setup_candidate_idle_s);
}

export function setupLostHours(summary: EventWindowSummary): number {
  return secondsToHours(summary.setup_candidate_idle_s);
}

export function firstPieceLostHours(summary: EventWindowSummary): number {
  return secondsToHours(summary.first_piece_candidate_idle_s);
}

export function hoursDelta(
  beforeHours: number,
  afterHours: number,
): { delta: number; abs: number; label: HoursDeltaLabel } {
  const delta = round3(afterHours - beforeHours);
  if (delta < 0) return { delta, abs: round3(-delta), label: "recovered" };
  if (delta > 0) return { delta, abs: delta, label: "worse" };
  return { delta: 0, abs: 0, label: "unchanged" };
}

export function formatHours(hours: number): string {
  return `${hours.toFixed(2)} hours`;
}

export function formatHoursDelta(
  beforeHours: number,
  afterHours: number,
): string {
  const { abs, label } = hoursDelta(beforeHours, afterHours);
  if (label === "unchanged") return `${formatHours(0)} unchanged`;
  return `${formatHours(abs)} ${label}`;
}

export function formatTimestamp(value: string | Date): string {
  const date = toDate(value);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatWindowRange(start: Date, end: Date): string {
  return `${formatTimestamp(start)} – ${formatTimestamp(end)}`;
}

export function windowResultFromEvents(
  events: MachineCaptureEvent[],
): WindowResult {
  if (events.length === 0) return { status: "empty" };
  return { status: "ok", summary: summarizeCaptureEvents(events) };
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
      status: "unavailable",
      reason: "events_unavailable",
      detail:
        "Machine events are not available yet, so before/after cannot be computed.",
    };
  }
  return {
    status: "report",
    before: windowResultFromEvents(
      eventsForImprovementWindow(events, change, "before"),
    ),
    after: windowResultFromEvents(
      eventsForImprovementWindow(events, change, "after"),
    ),
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
