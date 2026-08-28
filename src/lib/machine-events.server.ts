/**
 * Query helpers for iss.machine_event.v1.
 *
 * The CREATE TABLE lives on the machine-event ingest PR. Floor only selects
 * the spec column names. If neither candidate table exists yet, callers get
 * `eventsAvailable: false` rather than simulated machine data.
 *
 * Tenancy: events are filtered by organization_id, facility_id, and a
 * machine_id list taken from shop_machines the caller can already read
 * under RLS. Spec machine_id = shop_machines.asset_id.
 */

import type { PoolClient } from "pg";
import type { MachineEvent, MachineEventTable } from "@/lib/machine-events";
import { asIso } from "@/lib/shop-floor.server";

function isPgCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

export function isMissingMachineEventRelation(error: unknown): boolean {
  // 42P01 undefined_table, 42501 no GRANT yet — ingest PR not applied.
  return isPgCode(error, "42P01") || isPgCode(error, "42501");
}

function qualifiedTable(name: MachineEventTable): string {
  return `public.${name}`;
}

export async function resolveMachineEventTable(
  client: PoolClient,
): Promise<MachineEventTable | null> {
  const { rows } = await client.query<{
    shop: string | null;
    machine: string | null;
  }>(
    `SELECT to_regclass('public.shop_machine_events')::text AS shop,
            to_regclass('public.machine_events')::text AS machine`,
  );
  const row = rows[0];
  if (row?.shop) return "shop_machine_events";
  if (row?.machine) return "machine_events";
  return null;
}

function eventTimeColumn(table: MachineEventTable): string {
  // Ingest table uses spec column ts_utc. Floor's TypeScript model names
  // that instant occurred_at. Alias only in the SELECT list — WHERE/ORDER
  // must use the real column.
  return table === "shop_machine_events" ? "ts_utc" : "occurred_at";
}

export function mapMachineEvent(row: Record<string, unknown>): MachineEvent {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    facility_id: String(row.facility_id),
    machine_id: String(row.machine_id),
    occurred_at: asIso(row.occurred_at),
    event_type: String(row.event_type),
    state: row.state == null ? null : String(row.state),
    part_id: row.part_id == null ? null : String(row.part_id),
    program_name: row.program_name == null ? null : String(row.program_name),
  };
}

function eventSelect(table: MachineEventTable): string {
  const timeCol = eventTimeColumn(table);
  const timeExpr =
    timeCol === "occurred_at" ? "occurred_at" : `${timeCol} AS occurred_at`;
  return `id, organization_id, facility_id, machine_id, ${timeExpr},
       event_type, state, part_id, program_name`;
}

export async function listMachineEventsForFloor(
  client: PoolClient,
  input: {
    organizationId: string;
    facilityId: string;
    assetIds: string[];
    windowStart: Date;
    windowEnd: Date;
  },
): Promise<{ table: MachineEventTable | null; events: MachineEvent[] }> {
  const table = await resolveMachineEventTable(client);
  if (!table) return { table: null, events: [] };
  if (input.assetIds.length === 0) return { table, events: [] };

  const from = qualifiedTable(table);
  const select = eventSelect(table);
  const timeCol = eventTimeColumn(table);
  const scope = `organization_id = $1
          AND facility_id = $2
          AND machine_id = ANY($3::text[])`;
  const scopeParams = [input.organizationId, input.facilityId, input.assetIds];

  try {
    // Sequential on one client — node-pg does not multiplex a connection.
    const windowRows = await client.query(
      `SELECT ${select}
         FROM ${from}
        WHERE ${scope}
          AND ${timeCol} >= $4
          AND ${timeCol} < $5
        ORDER BY ${timeCol} ASC, id ASC`,
      [
        ...scopeParams,
        input.windowStart.toISOString(),
        input.windowEnd.toISOString(),
      ],
    );
    const carryRows = await client.query(
      `SELECT DISTINCT ON (machine_id) ${select}
         FROM ${from}
        WHERE ${scope}
          AND ${timeCol} < $4
        ORDER BY machine_id, ${timeCol} DESC, id DESC`,
      [...scopeParams, input.windowStart.toISOString()],
    );

    const seen = new Set<string>();
    const events: MachineEvent[] = [];
    for (const row of [...carryRows.rows, ...windowRows.rows]) {
      const mapped = mapMachineEvent(row as Record<string, unknown>);
      if (seen.has(mapped.id)) continue;
      seen.add(mapped.id);
      events.push(mapped);
    }
    return { table, events };
  } catch (error) {
    if (isMissingMachineEventRelation(error)) {
      return { table: null, events: [] };
    }
    throw error;
  }
}
