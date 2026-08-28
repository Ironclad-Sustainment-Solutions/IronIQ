/**
 * iss.machine_event.v1 contract: parse, validate, and idle-gap class.
 * No secrets, no HTTP, no database — safe to import from tests.
 */

import { z } from "zod";

export const MACHINE_EVENT_SCHEMA = "iss.machine_event.v1";

export const CAPTURE_PATHS = [
  "mtconnect",
  "focas",
  "opcua",
  "qcodes",
  "pmc",
  "discrete_io",
] as const;
export type CapturePath = (typeof CAPTURE_PATHS)[number];

export const EVENT_TYPES = [
  "state_change",
  "cycle_end",
  "alarm",
  "heartbeat",
] as const;
export type MachineEventType = (typeof EVENT_TYPES)[number];

export const MACHINE_STATES = ["RUNNING", "IDLE", "DOWN"] as const;
export type MachineState = (typeof MACHINE_STATES)[number];

export const GAP_CLASSES = [
  "SETUP_CANDIDATE",
  "FIRST_PIECE_CANDIDATE",
  "ALARM",
] as const;
export type GapClass = (typeof GAP_CLASSES)[number];

export const CONTROL_MODES = ["AUTO", "MDI", "JOG"] as const;
export type ControlMode = (typeof CONTROL_MODES)[number];

export const DEFAULT_IDLE_GAP_MINUTES = 15;
export const MAX_EVENTS_PER_POST = 100;

const nullableString = z.string().nullable().optional();
const nullableNonNeg = z.number().finite().nonnegative().nullable().optional();

export const QualitySchema = z.object({
  source_ok: z.boolean(),
  notes: z.string().nullable().optional(),
});

export const MachineEventSchema = z.object({
  schema: z.literal(MACHINE_EVENT_SCHEMA),
  plant_id: z.string().min(1),
  source_system: z.string().min(1),
  machine_id: z.string().min(1),
  machine_serial: nullableString,
  controller_make: nullableString,
  controller_model: nullableString,
  capture_path: z.enum(CAPTURE_PATHS),
  event_type: z.enum(EVENT_TYPES),
  ts_utc: z
    .string()
    .min(1)
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "ts_utc must be a valid timestamp",
    }),
  state: z.enum(MACHINE_STATES),
  prev_state: z.enum(MACHINE_STATES).nullable().optional(),
  program_name: nullableString,
  part_id: nullableString,
  job_id: nullableString,
  cycle_seq: z.number().int().nullable().optional(),
  cycle_time_s: nullableNonNeg,
  runtime_cutting_s: nullableNonNeg,
  spindle_on_s: nullableNonNeg,
  idle_since_prev_cycle_s: nullableNonNeg,
  gap_class: z.enum(GAP_CLASSES).nullable().optional(),
  alarm_code: nullableString,
  alarm_active: z.boolean().nullable().optional(),
  control_mode: z.enum(CONTROL_MODES).nullable().optional(),
  quality: QualitySchema.nullable().optional(),
});

export type MachineEvent = z.infer<typeof MachineEventSchema>;

const EventsEnvelopeSchema = z.object({
  events: z.array(MachineEventSchema).min(1).max(MAX_EVENTS_PER_POST),
});

export type ParseEventsResult =
  { ok: true; events: MachineEvent[] } | { ok: false; details: string[] };

function zodDetails(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "body";
    return `${path}: ${issue.message}`;
  });
}

/**
 * Accept one event object, or `{ events: [ ... ] }` up to 100.
 * A bare array is invalid — the edge must not retry a 400.
 */
export function parseMachineEventPayload(body: unknown): ParseEventsResult {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      details: ["body must be an event object or { events }"],
    };
  }
  const record = body as Record<string, unknown>;
  if (Array.isArray(record.events)) {
    const parsed = EventsEnvelopeSchema.safeParse(body);
    if (!parsed.success) {
      return { ok: false, details: zodDetails(parsed.error) };
    }
    return { ok: true, events: parsed.data.events };
  }
  const parsed = MachineEventSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, details: zodDetails(parsed.error) };
  }
  return { ok: true, events: [parsed.data] };
}

export function idleGapMinutesFromEnv(
  raw: string | undefined,
  fallback = DEFAULT_IDLE_GAP_MINUTES,
): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

/**
 * Idle gap > N minutes is classified in IronIQ, not by the CNC.
 * Posted SETUP_CANDIDATE is ignored; ALARM / FIRST_PIECE_CANDIDATE are kept.
 */
export function resolveGapClass(
  event: Pick<MachineEvent, "idle_since_prev_cycle_s" | "gap_class">,
  idleGapMinutes: number,
): GapClass | null {
  const posted = event.gap_class ?? null;
  if (posted === "ALARM" || posted === "FIRST_PIECE_CANDIDATE") {
    return posted;
  }
  const idle = event.idle_since_prev_cycle_s;
  if (idle != null && idle > idleGapMinutes * 60) {
    return "SETUP_CANDIDATE";
  }
  return null;
}
