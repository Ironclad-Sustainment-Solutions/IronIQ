import type { PoolClient } from "pg";
import type { ShopPart } from "@/lib/shop-floor";
import { mapShopPart } from "@/lib/shop-floor.server";
import {
  summarizePartCapture,
  type MachineEvent,
  type PartCaptureSummary,
} from "@/lib/part-capture";

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function asTextOrNull(value: unknown): string | null {
  if (value == null) return null;
  return String(value);
}

function asNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Expected columns on public.machine_events (owned by the ingest PR):
 *   machine_id, part_id, event_type, occurred_at, cycle_time_s,
 *   idle_time_s, idle_tag, organization_id, facility_id
 *
 * Do not create a second events table here. If ingest has not been
 * merged, this returns [].
 */
export async function machineEventsRelationExists(
  client: PoolClient,
): Promise<boolean> {
  const { rows } = await client.query<{ exists: boolean }>(
    `SELECT to_regclass('public.machine_events') IS NOT NULL AS exists`,
  );
  return Boolean(rows[0]?.exists);
}

export async function findShopPartByPartId(
  client: PoolClient,
  input: {
    organizationId: string;
    facilityId: string;
    partId: string;
  },
): Promise<ShopPart | null> {
  const { rows } = await client.query(
    `SELECT * FROM public.shop_parts
      WHERE organization_id = $1
        AND (part_number = $2 OR id::text = $2)
        AND (facility_id = $3 OR facility_id IS NULL)
      ORDER BY CASE WHEN facility_id = $3 THEN 0 ELSE 1 END, part_number
      LIMIT 1`,
    [input.organizationId, input.partId, input.facilityId],
  );
  return rows[0] ? mapShopPart(rows[0] as Record<string, unknown>) : null;
}

function mapMachineEvent(row: Record<string, unknown>): MachineEvent {
  const joinedAsset = asTextOrNull(row.joined_asset_id);
  const eventAsset = asTextOrNull(row.asset_id);
  const machineId = String(row.joined_machine_id ?? row.machine_id);
  return {
    id: String(row.id),
    organization_id: String(row.organization_id ?? ""),
    facility_id: String(row.facility_id ?? ""),
    machine_id: machineId,
    asset_id: joinedAsset || eventAsset || machineId,
    machine_name: asTextOrNull(row.machine_name),
    occurred_at: asIso(row.occurred_at ?? row.ts ?? row.created_at),
    event_type: String(row.event_type ?? row.type ?? ""),
    part_id: asTextOrNull(row.part_id),
    cycle_time_s: asNumberOrNull(row.cycle_time_s),
    idle_time_s: asNumberOrNull(row.idle_time_s ?? row.duration_s),
    idle_tag: asTextOrNull(row.idle_tag ?? row.tag),
  };
}

export async function listMachineEventsForPart(
  client: PoolClient,
  input: {
    organizationId: string;
    facilityId: string;
    partIds: string[];
  },
): Promise<MachineEvent[]> {
  if (input.partIds.length === 0) return [];
  if (!(await machineEventsRelationExists(client))) return [];

  try {
    const { rows } = await client.query(
      `SELECT e.*,
              m.id AS joined_machine_id,
              m.asset_id AS joined_asset_id,
              m.name AS machine_name,
              m.organization_id,
              m.facility_id
         FROM public.machine_events e
         INNER JOIN public.shop_machines m
           ON (m.id::text = e.machine_id::text
               OR m.asset_id = e.machine_id::text)
        WHERE e.part_id IS NOT NULL
          AND e.part_id::text = ANY($1::text[])
          AND m.organization_id = $2
          AND m.facility_id = $3`,
      [input.partIds, input.organizationId, input.facilityId],
    );
    return rows
      .map((row) => mapMachineEvent(row as Record<string, unknown>))
      .filter((event) => event.part_id != null)
      .sort(
        (a, b) =>
          new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
      );
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    // Ingest not merged yet, or relation vanished mid-request.
    if (code === "42P01") return [];
    throw error;
  }
}

export async function loadPartCapture(
  client: PoolClient,
  input: {
    organizationId: string;
    facilityId: string;
    partId: string;
  },
): Promise<PartCaptureSummary> {
  const shopPart = await findShopPartByPartId(client, input);
  const partIds = [
    ...new Set(
      [input.partId, shopPart?.id, shopPart?.part_number].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ];
  const events = await listMachineEventsForPart(client, {
    organizationId: input.organizationId,
    facilityId: input.facilityId,
    partIds,
  });
  return summarizePartCapture(events, input.partId, shopPart);
}
