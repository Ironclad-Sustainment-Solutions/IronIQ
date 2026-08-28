/**
 * iss.machine_event.v1 — Floor read model.
 *
 * Floor reads ingested machine events. It does not poll CNCs. IronIQ never
 * talks to a CNC from this path. Spec machine_id = shop_machines.asset_id.
 *
 * The events table itself is owned by the machine-event ingest PR
 * (`shop_machine_events` or `machine_events`). This module only names the
 * spec columns and derives Floor rows in TypeScript so this PR can merge
 * independently without a diverging CREATE TABLE.
 */

export const MACHINE_EVENT_SCHEMA = "iss.machine_event.v1";

export const MACHINE_EVENT_TABLES = [
  "shop_machine_events",
  "machine_events",
] as const;

export type MachineEventTable = (typeof MACHINE_EVENT_TABLES)[number];

/** Spec columns the ingest table is expected to expose. */
export const MACHINE_EVENT_COLUMNS = [
  "id",
  "organization_id",
  "facility_id",
  "machine_id",
  "occurred_at",
  "event_type",
  "state",
  "part_id",
  "program_name",
] as const;

export const FLOOR_STATES = ["RUNNING", "IDLE", "DOWN"] as const;
export type FloorState = (typeof FLOOR_STATES)[number];

export interface MachineEvent {
  id: string;
  organization_id: string;
  facility_id: string;
  /** Spec: shop_machines.asset_id */
  machine_id: string;
  occurred_at: string;
  event_type: string;
  state: string | null;
  part_id: string | null;
  program_name: string | null;
}

export interface FloorMachineIdentity {
  id: string;
  asset_id: string;
  name: string;
  make: string;
  model: string;
  location: string | null;
}

export interface FloorTimelineSegment {
  start: string;
  end: string;
  state: FloorState | null;
  partOrProgram: string | null;
}

export interface FloorMachineRow {
  machineId: string;
  assetId: string;
  name: string;
  make: string;
  model: string;
  location: string | null;
  /** False when this machine has no ingested events in/before the window. */
  connected: boolean;
  state: FloorState | null;
  currentPartOrProgram: string | null;
  cyclesToday: number;
  runHours: number;
  idleHours: number;
  timeline: FloorTimelineSegment[];
}

export interface FloorView {
  eventsAvailable: boolean;
  asOf: string;
  windowStart: string;
  windowEnd: string;
  rows: FloorMachineRow[];
}

const HEARTBEAT_TYPE = /^(heartbeat|heart_beat|ping)$/i;
const CYCLE_END_TYPE = /^(cycle_end|cycle-end|cycleend)$/i;

export function isHeartbeatEventType(eventType: string): boolean {
  return HEARTBEAT_TYPE.test(eventType.trim());
}

export function isCycleEndEventType(eventType: string): boolean {
  return CYCLE_END_TYPE.test(eventType.trim());
}

function clean(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Prefer part_id when present; fall back to program_name when part_id is null.
 */
export function currentPartOrProgram(
  event: Pick<MachineEvent, "part_id" | "program_name"> | null | undefined,
): string | null {
  if (!event) return null;
  return clean(event.part_id) ?? clean(event.program_name);
}

export function resolveFloorState(
  event: Pick<MachineEvent, "event_type" | "state">,
): FloorState | null {
  const fromState = mapStateToken(event.state);
  if (fromState) return fromState;
  return mapEventTypeToState(event.event_type);
}

function mapStateToken(value: string | null | undefined): FloorState | null {
  const s = clean(value)?.toUpperCase();
  if (!s) return null;
  if (
    s === "RUNNING" ||
    s === "RUN" ||
    s === "ACTIVE" ||
    s === "EXECUTING" ||
    s === "IN_CYCLE" ||
    s === "IN-CYCLE"
  ) {
    return "RUNNING";
  }
  if (
    s === "IDLE" ||
    s === "READY" ||
    s === "STOPPED" ||
    s === "PROGRAM_STOPPED" ||
    s === "FEED_HOLD"
  ) {
    return "IDLE";
  }
  if (
    s === "DOWN" ||
    s === "ALARM" ||
    s === "FAULTED" ||
    s === "FAULT" ||
    s === "UNAVAILABLE" ||
    s === "OFFLINE" ||
    s === "EMERGENCY_STOP" ||
    s === "E_STOP"
  ) {
    return "DOWN";
  }
  return null;
}

function mapEventTypeToState(eventType: string): FloorState | null {
  const t = eventType.trim().toLowerCase().replace(/-/g, "_");
  if (
    t === "running" ||
    t === "run" ||
    t === "cycle_start" ||
    t === "active" ||
    t === "in_cycle"
  ) {
    return "RUNNING";
  }
  if (t === "idle" || t === "stopped" || t === "ready") return "IDLE";
  if (t === "down" || t === "alarm" || t === "fault") return "DOWN";
  return null;
}

export function sortEvents(events: MachineEvent[]): MachineEvent[] {
  return [...events].sort((a, b) => {
    const dt =
      new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime();
    if (dt !== 0) return dt;
    return a.id.localeCompare(b.id);
  });
}

function roundHours(ms: number): number {
  if (ms <= 0) return 0;
  return Math.round((ms / 3_600_000) * 100) / 100;
}

export function formatFloorHours(hours: number): string {
  return `${hours.toFixed(2)} h`;
}

export function localDayWindow(now: Date): { start: Date; end: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return { start, end: now };
}

function latestNonHeartbeat(
  events: MachineEvent[],
  cutoff: Date,
  mode: "inclusive" | "exclusive",
): MachineEvent | null {
  const cutoffMs = cutoff.getTime();
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    const t = new Date(event.occurred_at).getTime();
    if (mode === "exclusive" ? t >= cutoffMs : t > cutoffMs) continue;
    if (isHeartbeatEventType(event.event_type)) continue;
    return event;
  }
  return null;
}

function shouldAdvanceTimeline(
  event: MachineEvent,
): { state: FloorState | null; partOrProgram: string | null } | null {
  const partOrProgram = currentPartOrProgram(event);
  if (isHeartbeatEventType(event.event_type)) {
    const state = mapStateToken(event.state);
    if (!state && !partOrProgram) return null;
    return { state, partOrProgram };
  }
  return {
    state: resolveFloorState(event),
    partOrProgram,
  };
}

export function buildFloorMachineRow(
  machine: FloorMachineIdentity,
  eventsForMachine: MachineEvent[],
  windowStart: Date,
  windowEnd: Date,
): FloorMachineRow {
  const events = sortEvents(
    eventsForMachine.filter((e) => e.machine_id === machine.asset_id),
  );
  const startMs = windowStart.getTime();
  const endMs = windowEnd.getTime();

  const inWindow = events.filter((e) => {
    const t = new Date(e.occurred_at).getTime();
    return t >= startMs && t < endMs;
  });

  const latest = latestNonHeartbeat(events, windowEnd, "inclusive");
  const connected = events.some((e) => !isHeartbeatEventType(e.event_type));
  const state = latest ? resolveFloorState(latest) : null;

  const cyclesToday = inWindow.filter((e) =>
    isCycleEndEventType(e.event_type),
  ).length;

  const carryIn = latestNonHeartbeat(events, windowStart, "exclusive");
  let currentState: FloorState | null = carryIn
    ? resolveFloorState(carryIn)
    : null;
  let currentPart = currentPartOrProgram(carryIn);

  const segments: FloorTimelineSegment[] = [];
  let cursor = startMs;
  let runMs = 0;
  let idleMs = 0;

  function close(until: number) {
    const clamped = Math.min(Math.max(until, cursor), endMs);
    if (clamped <= cursor) return;
    if (currentState === "RUNNING") runMs += clamped - cursor;
    else if (currentState === "IDLE") idleMs += clamped - cursor;
    const last = segments[segments.length - 1];
    if (
      last &&
      last.state === currentState &&
      last.partOrProgram === currentPart &&
      new Date(last.end).getTime() === cursor
    ) {
      last.end = new Date(clamped).toISOString();
    } else {
      segments.push({
        start: new Date(cursor).toISOString(),
        end: new Date(clamped).toISOString(),
        state: currentState,
        partOrProgram: currentPart,
      });
    }
    cursor = clamped;
  }

  for (const event of inWindow) {
    const at = new Date(event.occurred_at).getTime();
    const change = shouldAdvanceTimeline(event);
    if (!change) continue;
    close(at);
    if (change.state) currentState = change.state;
    if (change.partOrProgram) currentPart = change.partOrProgram;
  }
  close(endMs);

  return {
    machineId: machine.id,
    assetId: machine.asset_id,
    name: machine.name,
    make: machine.make,
    model: machine.model,
    location: machine.location,
    connected,
    state: connected ? state : null,
    currentPartOrProgram: connected ? currentPartOrProgram(latest) : null,
    cyclesToday: connected ? cyclesToday : 0,
    runHours: connected ? roundHours(runMs) : 0,
    idleHours: connected ? roundHours(idleMs) : 0,
    timeline: connected ? segments : [],
  };
}

export function buildFloorView(args: {
  machines: FloorMachineIdentity[];
  events: MachineEvent[];
  eventsAvailable: boolean;
  windowStart: Date;
  windowEnd: Date;
}): FloorView {
  const eventsByAsset = new Map<string, MachineEvent[]>();
  for (const event of args.events) {
    const list = eventsByAsset.get(event.machine_id) ?? [];
    list.push(event);
    eventsByAsset.set(event.machine_id, list);
  }

  return {
    eventsAvailable: args.eventsAvailable,
    asOf: args.windowEnd.toISOString(),
    windowStart: args.windowStart.toISOString(),
    windowEnd: args.windowEnd.toISOString(),
    rows: args.machines.map((machine) =>
      buildFloorMachineRow(
        machine,
        args.eventsAvailable ? (eventsByAsset.get(machine.asset_id) ?? []) : [],
        args.windowStart,
        args.windowEnd,
      ),
    ),
  };
}

export const MAX_FLOOR_WINDOW_MS = 48 * 60 * 60 * 1000;

export function parseFloorWindow(
  windowStartIso: string,
  windowEndIso: string,
): { start: Date; end: Date } {
  const start = new Date(windowStartIso);
  const end = new Date(windowEndIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Floor window is not a valid date range.");
  }
  if (end.getTime() <= start.getTime()) {
    throw new Error("Floor window end must be after start.");
  }
  if (end.getTime() - start.getTime() > MAX_FLOOR_WINDOW_MS) {
    throw new Error("Floor window cannot exceed 48 hours.");
  }
  return { start, end };
}
