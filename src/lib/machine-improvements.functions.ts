/**
 * Saved machine-change windows + before/after queries over capture events.
 * Does not write typed before/after numbers and does not create the events
 * table (sibling ingest PR).
 */

import { createServerFn } from "@tanstack/react-start";
import type { PoolClient } from "pg";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import {
  MACHINE_CAPTURE_EVENTS_TABLE,
  computeImprovementBeforeAfter,
  eventQueryFromImprovement,
  type ImprovementComparison,
  type MachineCaptureEvent,
  type ShopMachineImprovement,
} from "@/lib/machine-improvements";
import { upsertShopPart } from "@/lib/shop-floor.server";

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapImprovement(row: Record<string, unknown>): ShopMachineImprovement {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    facility_id: String(row.facility_id),
    plant_id: String(row.plant_id),
    part_id: String(row.part_id),
    machine_id: String(row.machine_id),
    title: String(row.title),
    changed_at: asIso(row.changed_at),
    window_before_hours: Number(row.window_before_hours),
    window_after_hours: Number(row.window_after_hours),
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
    part_number: row.part_number == null ? null : String(row.part_number),
    machine_asset_id:
      row.machine_asset_id == null ? null : String(row.machine_asset_id),
    machine_label: row.machine_label == null ? null : String(row.machine_label),
    plant_name: row.plant_name == null ? null : String(row.plant_name),
  };
}

function mapCaptureEvent(row: Record<string, unknown>): MachineCaptureEvent {
  return {
    ts_utc: asIso(row.ts_utc),
    machine_id: String(row.machine_id),
    part_id: row.part_id == null ? null : String(row.part_id),
    program_name: row.program_name == null ? null : String(row.program_name),
    event_type: row.event_type == null ? "" : String(row.event_type),
    cycle_seq: row.cycle_seq == null ? null : Number(row.cycle_seq),
    cycle_time_s: row.cycle_time_s == null ? null : Number(row.cycle_time_s),
    idle_since_prev_cycle_s:
      row.idle_since_prev_cycle_s == null
        ? null
        : Number(row.idle_since_prev_cycle_s),
    gap_class: row.gap_class == null ? null : String(row.gap_class),
  };
}

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  return code === "42P01" || code === "42703";
}

const IMPROVEMENT_SELECT = `
  SELECT i.*,
         p.part_number,
         m.asset_id AS machine_asset_id,
         CASE
           WHEN m.id IS NULL THEN NULL
           ELSE m.asset_id || ' — ' || m.name
         END AS machine_label,
         f.name AS plant_name
    FROM public.shop_machine_improvements i
    JOIN public.shop_parts p ON p.id = i.part_id
    JOIN public.shop_machines m ON m.id = i.machine_id
    JOIN public.facilities f ON f.id = i.plant_id
`;

const ListInput = z.object({
  organizationId: z.string().uuid(),
  facilityId: z.string().uuid(),
});

export const listMachineImprovements = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ListInput.parse(d))
  .handler(async ({ data, context }) => {
    return withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `${IMPROVEMENT_SELECT}
          WHERE i.organization_id = $1 AND i.facility_id = $2
          ORDER BY i.changed_at DESC`,
        [data.organizationId, data.facilityId],
      );
      return rows.map((row) => mapImprovement(row as Record<string, unknown>));
    });
  });

const CreateInput = z
  .object({
    organizationId: z.string().uuid(),
    facilityId: z.string().uuid(),
    machineId: z.string().uuid(),
    partId: z.string().uuid().optional(),
    partNumber: z.string().min(1).optional(),
    title: z.string().min(1),
    changedAt: z.string().min(1),
    windowBeforeHours: z.number().positive(),
    windowAfterHours: z.number().positive(),
  })
  .refine((d) => d.partId || d.partNumber, {
    message: "Select a part or enter a part number.",
  });

export const createMachineImprovement = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const changedAt = new Date(data.changedAt);
    if (Number.isNaN(changedAt.getTime())) {
      throw new Error("changed_at is not a valid timestamp");
    }
    return withUser(context.userId, async (client) => {
      const machine = await client.query(
        `SELECT id FROM public.shop_machines
          WHERE id = $1 AND organization_id = $2 AND facility_id = $3`,
        [data.machineId, data.organizationId, data.facilityId],
      );
      if (!machine.rows[0]) {
        throw new Error("Machine not found or not accessible.");
      }
      let partId = data.partId;
      if (partId) {
        const part = await client.query(
          `SELECT id FROM public.shop_parts
            WHERE id = $1 AND organization_id = $2`,
          [partId, data.organizationId],
        );
        if (!part.rows[0]) {
          throw new Error("Part not found or not accessible.");
        }
      } else {
        const part = await upsertShopPart(client, {
          organizationId: data.organizationId,
          facilityId: data.facilityId,
          partNumber: data.partNumber as string,
        });
        partId = part.id;
      }
      const { rows } = await client.query(
        `INSERT INTO public.shop_machine_improvements
           (organization_id, facility_id, plant_id, part_id, machine_id,
            title, changed_at, window_before_hours, window_after_hours, created_by)
         VALUES ($1,$2,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [
          data.organizationId,
          data.facilityId,
          partId,
          data.machineId,
          data.title.trim(),
          changedAt.toISOString(),
          data.windowBeforeHours,
          data.windowAfterHours,
          context.userId,
        ],
      );
      const { rows: saved } = await client.query(
        `${IMPROVEMENT_SELECT} WHERE i.id = $1`,
        [rows[0].id],
      );
      return mapImprovement(saved[0] as Record<string, unknown>);
    });
  });

async function loadCaptureEvents(
  client: PoolClient,
  change: ShopMachineImprovement,
): Promise<MachineCaptureEvent[] | null> {
  const present = await client.query<{ rel: string | null }>(
    `SELECT to_regclass($1) AS rel`,
    [`public.${MACHINE_CAPTURE_EVENTS_TABLE}`],
  );
  if (!present.rows[0]?.rel) return null;

  const query = eventQueryFromImprovement(change);
  if (!query) return [];

  const beforeMs = change.window_before_hours * 60 * 60 * 1000;
  const afterMs = change.window_after_hours * 60 * 60 * 1000;
  const changedAt = new Date(change.changed_at);
  const windowStart = new Date(changedAt.getTime() - beforeMs);
  const windowEnd = new Date(changedAt.getTime() + afterMs);

  try {
    const { rows } = await client.query(
      `SELECT ts_utc, machine_id, part_id, program_name, event_type,
              cycle_seq, cycle_time_s, idle_since_prev_cycle_s, gap_class
         FROM public.${MACHINE_CAPTURE_EVENTS_TABLE}
        WHERE machine_id = $1
          AND part_id = $2
          AND ts_utc >= $3
          AND ts_utc < $4`,
      [
        query.machine_id,
        query.part_id,
        windowStart.toISOString(),
        windowEnd.toISOString(),
      ],
    );
    return rows.map((row) => mapCaptureEvent(row as Record<string, unknown>));
  } catch (error) {
    if (isMissingRelationError(error)) return null;
    throw error;
  }
}

const CompareInput = z.object({ id: z.string().uuid() });

export const getMachineImprovementComparison = createServerFn({
  method: "GET",
})
  .middleware([requireAuth])
  .inputValidator((d: unknown) => CompareInput.parse(d))
  .handler(async ({ data, context }) => {
    return withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `${IMPROVEMENT_SELECT} WHERE i.id = $1`,
        [data.id],
      );
      if (!rows[0]) {
        throw new Error("Saved change not found or not accessible.");
      }
      const improvement = mapImprovement(rows[0] as Record<string, unknown>);
      const query = eventQueryFromImprovement(improvement);
      if (!query) {
        const comparison: ImprovementComparison = {
          status: "report",
          before: { status: "empty" },
          after: { status: "empty" },
        };
        return { improvement, comparison };
      }
      const events = await loadCaptureEvents(client, improvement);
      const comparison: ImprovementComparison = computeImprovementBeforeAfter(
        query,
        events,
      );
      return { improvement, comparison };
    });
  });
