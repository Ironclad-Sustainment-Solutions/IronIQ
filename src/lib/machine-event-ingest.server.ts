/**
 * Trusted-writer ingest for iss.machine_event.v1 from an IronIQ Edge box.
 *
 * Real HTTP handler (not a cookie-session serverFn). Auth is a dedicated
 * edge ingest secret compared timing-safe; not a query param and not a
 * CSRF hole in session auth. CSRF middleware still applies only to
 * serverFns (src/start.ts).
 */

import { timingSafeEqual } from "node:crypto";
import type { PoolClient } from "pg";
import { withAdmin } from "@/lib/db.server";
import {
  idleGapMinutesFromEnv,
  parseMachineEventPayload,
  resolveGapClass,
  type MachineEvent,
} from "@/lib/machine-event";

export interface ShopMachineRef {
  id: string;
  organization_id: string;
  facility_id: string;
  asset_id: string;
}

export interface StoredMachineEvent {
  event_schema: string;
  plant_id: string;
  source_system: string;
  machine_id: string;
  shop_machine_id: string;
  organization_id: string;
  facility_id: string;
  machine_serial: string | null;
  controller_make: string | null;
  controller_model: string | null;
  capture_path: string;
  event_type: string;
  ts_utc: string;
  state: string;
  prev_state: string | null;
  program_name: string | null;
  part_id: string | null;
  job_id: string | null;
  cycle_seq: number | null;
  cycle_time_s: number | null;
  runtime_cutting_s: number | null;
  spindle_on_s: number | null;
  idle_since_prev_cycle_s: number | null;
  gap_class: string | null;
  alarm_code: string | null;
  alarm_active: boolean | null;
  control_mode: string | null;
  quality: { source_ok: boolean; notes?: string | null } | null;
}

export type MachineLookup = "missing" | "ambiguous" | ShopMachineRef;

export interface MachineEventStore {
  lookupByAssetId(assetId: string): Promise<MachineLookup>;
  insertEvent(row: StoredMachineEvent): Promise<"accepted" | "duplicate">;
  listByMachineId(machineId: string): Promise<StoredMachineEvent[]>;
}

export interface HandleMachineEventsOptions {
  store?: MachineEventStore;
  edgeSecret?: string | undefined;
  idleGapMinutes?: number;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function asText(value: string | null | undefined): string | null {
  if (value == null) return null;
  return value;
}

function asNum(value: number | null | undefined): number | null {
  if (value == null) return null;
  return value;
}

function eventKey(
  event: Pick<
    StoredMachineEvent,
    "machine_id" | "ts_utc" | "event_type" | "cycle_seq"
  >,
) {
  return `${event.machine_id}\0${event.ts_utc}\0${event.event_type}\0${event.cycle_seq ?? ""}`;
}

export function createMemoryMachineEventStore(
  machines: ShopMachineRef[],
): MachineEventStore {
  const rows: StoredMachineEvent[] = [];
  return {
    async lookupByAssetId(assetId) {
      const matches = machines.filter((m) => m.asset_id === assetId);
      if (matches.length === 0) return "missing";
      if (matches.length > 1) return "ambiguous";
      return matches[0];
    },
    async insertEvent(row) {
      const key = eventKey(row);
      if (rows.some((existing) => eventKey(existing) === key)) {
        return "duplicate";
      }
      rows.push(row);
      return "accepted";
    },
    async listByMachineId(machineId) {
      return rows.filter((row) => row.machine_id === machineId);
    },
  };
}

export function createPgMachineEventStore(
  client: PoolClient,
): MachineEventStore {
  return {
    async lookupByAssetId(assetId) {
      const { rows } = await client.query<{
        id: string;
        organization_id: string;
        facility_id: string;
        asset_id: string;
      }>(
        `SELECT id, organization_id, facility_id, asset_id
           FROM public.shop_machines
          WHERE asset_id = $1`,
        [assetId],
      );
      if (rows.length === 0) return "missing";
      if (rows.length > 1) return "ambiguous";
      return {
        id: String(rows[0].id),
        organization_id: String(rows[0].organization_id),
        facility_id: String(rows[0].facility_id),
        asset_id: String(rows[0].asset_id),
      };
    },
    async insertEvent(row) {
      const result = await client.query(
        `INSERT INTO public.shop_machine_events (
           organization_id, facility_id, shop_machine_id,
           event_schema, plant_id, source_system, machine_id, machine_serial,
           controller_make, controller_model, capture_path, event_type, ts_utc,
           state, prev_state, program_name, part_id, job_id, cycle_seq,
           cycle_time_s, runtime_cutting_s, spindle_on_s, idle_since_prev_cycle_s,
           gap_class, alarm_code, alarm_active, control_mode, quality
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
           $20,$21,$22,$23,$24,$25,$26,$27,$28
         )
         ON CONFLICT ON CONSTRAINT shop_machine_events_idempotency DO NOTHING
         RETURNING id`,
        [
          row.organization_id,
          row.facility_id,
          row.shop_machine_id,
          row.event_schema,
          row.plant_id,
          row.source_system,
          row.machine_id,
          row.machine_serial,
          row.controller_make,
          row.controller_model,
          row.capture_path,
          row.event_type,
          row.ts_utc,
          row.state,
          row.prev_state,
          row.program_name,
          row.part_id,
          row.job_id,
          row.cycle_seq,
          row.cycle_time_s,
          row.runtime_cutting_s,
          row.spindle_on_s,
          row.idle_since_prev_cycle_s,
          row.gap_class,
          row.alarm_code,
          row.alarm_active,
          row.control_mode,
          row.quality,
        ],
      );
      return result.rowCount && result.rowCount > 0 ? "accepted" : "duplicate";
    },
    async listByMachineId(machineId) {
      const { rows } = await client.query(
        `SELECT * FROM public.shop_machine_events
          WHERE machine_id = $1
          ORDER BY ts_utc`,
        [machineId],
      );
      return rows.map((row) => mapStored(row as Record<string, unknown>));
    },
  };
}

function mapStored(row: Record<string, unknown>): StoredMachineEvent {
  const quality = row.quality;
  return {
    event_schema: String(row.event_schema),
    plant_id: String(row.plant_id),
    source_system: String(row.source_system),
    machine_id: String(row.machine_id),
    shop_machine_id: String(row.shop_machine_id),
    organization_id: String(row.organization_id),
    facility_id: String(row.facility_id),
    machine_serial:
      row.machine_serial == null ? null : String(row.machine_serial),
    controller_make:
      row.controller_make == null ? null : String(row.controller_make),
    controller_model:
      row.controller_model == null ? null : String(row.controller_model),
    capture_path: String(row.capture_path),
    event_type: String(row.event_type),
    ts_utc:
      row.ts_utc instanceof Date
        ? row.ts_utc.toISOString()
        : String(row.ts_utc),
    state: String(row.state),
    prev_state: row.prev_state == null ? null : String(row.prev_state),
    program_name: row.program_name == null ? null : String(row.program_name),
    part_id: row.part_id == null ? null : String(row.part_id),
    job_id: row.job_id == null ? null : String(row.job_id),
    cycle_seq: row.cycle_seq == null ? null : Number(row.cycle_seq),
    cycle_time_s: row.cycle_time_s == null ? null : Number(row.cycle_time_s),
    runtime_cutting_s:
      row.runtime_cutting_s == null ? null : Number(row.runtime_cutting_s),
    spindle_on_s: row.spindle_on_s == null ? null : Number(row.spindle_on_s),
    idle_since_prev_cycle_s:
      row.idle_since_prev_cycle_s == null
        ? null
        : Number(row.idle_since_prev_cycle_s),
    gap_class: row.gap_class == null ? null : String(row.gap_class),
    alarm_code: row.alarm_code == null ? null : String(row.alarm_code),
    alarm_active: row.alarm_active == null ? null : Boolean(row.alarm_active),
    control_mode: row.control_mode == null ? null : String(row.control_mode),
    quality:
      quality && typeof quality === "object"
        ? (quality as StoredMachineEvent["quality"])
        : null,
  };
}

function toStored(
  event: MachineEvent,
  machine: ShopMachineRef,
  idleGapMinutes: number,
): StoredMachineEvent {
  return {
    event_schema: event.schema,
    plant_id: event.plant_id,
    source_system: event.source_system,
    machine_id: event.machine_id,
    shop_machine_id: machine.id,
    organization_id: machine.organization_id,
    facility_id: machine.facility_id,
    machine_serial: asText(event.machine_serial),
    controller_make: asText(event.controller_make),
    controller_model: asText(event.controller_model),
    capture_path: event.capture_path,
    event_type: event.event_type,
    ts_utc: new Date(event.ts_utc).toISOString(),
    state: event.state,
    prev_state: event.prev_state ?? null,
    program_name: asText(event.program_name),
    part_id: asText(event.part_id),
    job_id: asText(event.job_id),
    cycle_seq: event.cycle_seq ?? null,
    cycle_time_s: asNum(event.cycle_time_s),
    runtime_cutting_s: asNum(event.runtime_cutting_s),
    spindle_on_s: asNum(event.spindle_on_s),
    idle_since_prev_cycle_s: asNum(event.idle_since_prev_cycle_s),
    gap_class: resolveGapClass(event, idleGapMinutes),
    alarm_code: asText(event.alarm_code),
    alarm_active: event.alarm_active ?? null,
    control_mode: event.control_mode ?? null,
    quality: event.quality ?? null,
  };
}

/**
 * Timing-safe compare of the configured edge secret against the Bearer
 * token. Length mismatch is padded so crypto.timingSafeEqual always runs.
 * Query parameters are never read.
 */
export function bearerTokenFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(\S+)/i.exec(header.trim());
  return match?.[1] ?? null;
}

export function edgeSecretMatches(
  provided: string | null,
  expected: string | undefined,
): boolean {
  if (!expected || expected.length === 0 || provided == null) {
    return false;
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const len = Math.max(a.length, b.length);
  const paddedA = Buffer.alloc(len);
  const paddedB = Buffer.alloc(len);
  a.copy(paddedA);
  b.copy(paddedB);
  const sameLength = a.length === b.length;
  return timingSafeEqual(paddedA, paddedB) && sameLength;
}

export async function ingestMachineEvents(
  events: MachineEvent[],
  store: MachineEventStore,
  idleGapMinutes: number,
): Promise<
  | { accepted: number; duplicates: number }
  | { error: string; details: string[] }
> {
  const uniqueIds = [...new Set(events.map((e) => e.machine_id))];
  const machines = new Map<string, ShopMachineRef>();
  for (const assetId of uniqueIds) {
    const found = await store.lookupByAssetId(assetId);
    if (found === "missing") {
      return {
        error: "invalid payload",
        details: [`machine_id: unknown asset_id ${assetId}`],
      };
    }
    if (found === "ambiguous") {
      return {
        error: "invalid payload",
        details: [`machine_id: ambiguous asset_id ${assetId}`],
      };
    }
    machines.set(assetId, found);
  }

  let accepted = 0;
  let duplicates = 0;
  for (const event of events) {
    const machine = machines.get(event.machine_id);
    if (!machine) {
      return {
        error: "invalid payload",
        details: [`machine_id: unknown asset_id ${event.machine_id}`],
      };
    }
    const result = await store.insertEvent(
      toStored(event, machine, idleGapMinutes),
    );
    if (result === "accepted") accepted += 1;
    else duplicates += 1;
  }
  return { accepted, duplicates };
}

export async function handleMachineEventsRequest(
  request: Request,
  options: HandleMachineEventsOptions = {},
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "method not allowed" });
  }

  const expected = options.edgeSecret ?? process.env.IRONIQ_EDGE_INGEST_SECRET;
  const provided = bearerTokenFromRequest(request);
  if (!edgeSecretMatches(provided, expected)) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, {
      error: "invalid payload",
      details: ["body: must be JSON"],
    });
  }

  const parsed = parseMachineEventPayload(body);
  if (!parsed.ok) {
    return jsonResponse(400, {
      error: "invalid payload",
      details: parsed.details,
    });
  }

  const idleGapMinutes =
    options.idleGapMinutes ??
    idleGapMinutesFromEnv(process.env.IRONIQ_IDLE_GAP_MINUTES);

  try {
    const run = async (store: MachineEventStore) => {
      const result = await ingestMachineEvents(
        parsed.events,
        store,
        idleGapMinutes,
      );
      if ("error" in result) {
        return jsonResponse(400, result);
      }
      return jsonResponse(202, result);
    };

    if (options.store) {
      return await run(options.store);
    }
    return await withAdmin((client) => run(createPgMachineEventStore(client)));
  } catch (error) {
    console.error(error);
    return jsonResponse(500, { error: "internal error" });
  }
}
