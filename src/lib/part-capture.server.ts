import type { PoolClient } from "pg";
import type { ShopPart } from "@/lib/shop-floor";
import { mapShopPart } from "@/lib/shop-floor.server";
import {
  summarizePartCapture,
  type PartCaptureSummary,
  type ShopMachineEvent,
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
 * public.shop_machine_events is owned by the ingest PR (iss.machine_event.v1):
 *   machine_id = shop_machines.asset_id
 *   ts_utc, event_type (cycle_end|state_change|alarm|heartbeat)
 *   cycle_time_s, idle_since_prev_cycle_s, gap_class, program_name, part_id
 *
 * Do not CREATE that table here. If ingest has not been merged, this returns [].
 */
export async function shopMachineEventsRelationExists(
  client: PoolClient,
): Promise<boolean> {
  const { rows } = await client.query<{ exists: boolean }>(
    `SELECT to_regclass('public.shop_machine_events') IS NOT NULL AS exists`,
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

function mapShopMachineEvent(row: Record<string, unknown>): ShopMachineEvent {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id ?? ""),
    facility_id: String(row.facility_id ?? ""),
    shop_machine_id: String(row.shop_machine_id),
    machine_id: String(row.machine_id),
    machine_name: asTextOrNull(row.machine_name),
    ts_utc: asIso(row.ts_utc),
    event_type: String(row.event_type ?? ""),
    program_name: asTextOrNull(row.program_name),
    part_id: asTextOrNull(row.part_id),
    cycle_time_s: asNumberOrNull(row.cycle_time_s),
    idle_since_prev_cycle_s: asNumberOrNull(row.idle_since_prev_cycle_s),
    gap_class: asTextOrNull(row.gap_class),
  };
}

export async function listMachineEventsForPart(
  client: PoolClient,
  input: {
    organizationId: string;
    facilityId: string;
    partIds: string[];
  },
): Promise<ShopMachineEvent[]> {
  if (input.partIds.length === 0) return [];
  if (!(await shopMachineEventsRelationExists(client))) return [];

  try {
    const { rows } = await client.query(
      `SELECT e.id,
              e.organization_id,
              e.facility_id,
              e.shop_machine_id,
              e.machine_id,
              e.ts_utc,
              e.event_type,
              e.program_name,
              e.part_id,
              e.cycle_time_s,
              e.idle_since_prev_cycle_s,
              e.gap_class,
              m.name AS machine_name
         FROM public.shop_machine_events e
         INNER JOIN public.shop_machines m ON m.id = e.shop_machine_id
        WHERE e.part_id IS NOT NULL
          AND e.part_id = ANY($1::text[])
          AND e.organization_id = $2
          AND e.facility_id = $3
          AND m.organization_id = $2
          AND m.facility_id = $3`,
      [input.partIds, input.organizationId, input.facilityId],
    );
    return rows
      .map((row) => mapShopMachineEvent(row as Record<string, unknown>))
      .filter((event) => event.part_id != null)
      .sort(
        (a, b) => new Date(a.ts_utc).getTime() - new Date(b.ts_utc).getTime(),
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
