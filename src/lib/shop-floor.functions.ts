/**
 * Facility-scoped shop-floor machines and manual/CSV run events.
 * No live machine protocol client lives here.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import {
  CONNECTION_STATUSES,
  MACHINE_CONTROLS,
  MACHINE_PROTOCOLS,
  parseRunCsv,
  type MachineRunEvent,
  type ShopMachine,
} from "@/lib/shop-floor";
import {
  PART_CARD_SELECT,
  mapPartCard,
  mapShopPart,
  upsertShopPart,
} from "@/lib/shop-floor.server";

const MachineWrite = z.object({
  organizationId: z.string().uuid(),
  facilityId: z.string().uuid(),
  assetId: z.string().min(1),
  name: z.string().min(1),
  make: z.string().min(1),
  model: z.string().min(1),
  control: z.enum(MACHINE_CONTROLS),
  protocol: z.enum(MACHINE_PROTOCOLS),
  location: z.string().optional(),
});

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapMachine(row: Record<string, unknown>): ShopMachine {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    facility_id: String(row.facility_id),
    asset_id: String(row.asset_id),
    name: String(row.name),
    make: String(row.make),
    model: String(row.model),
    control: row.control as ShopMachine["control"],
    protocol: row.protocol as ShopMachine["protocol"],
    connection_status:
      row.connection_status as ShopMachine["connection_status"],
    location: row.location == null ? null : String(row.location),
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
  };
}

function mapRun(row: Record<string, unknown>): MachineRunEvent {
  return {
    id: String(row.id),
    machine_id: String(row.machine_id),
    organization_id: String(row.organization_id),
    facility_id: String(row.facility_id),
    occurred_at: asIso(row.occurred_at),
    part_number: String(row.part_number),
    cycles: Number(row.cycles),
    runtime_minutes: Number(row.runtime_minutes),
    idle_minutes: Number(row.idle_minutes),
    downtime_minutes: Number(row.downtime_minutes),
    source: row.source as MachineRunEvent["source"],
    created_at: asIso(row.created_at),
  };
}

const ListMachinesInput = z.object({
  organizationId: z.string().uuid(),
  facilityId: z.string().uuid(),
});

export const listShopMachines = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ListMachinesInput.parse(d))
  .handler(async ({ data, context }) => {
    return withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.shop_machines
          WHERE organization_id = $1 AND facility_id = $2
          ORDER BY asset_id`,
        [data.organizationId, data.facilityId],
      );
      return rows.map((row) => mapMachine(row as Record<string, unknown>));
    });
  });

const GetMachineInput = z.object({ id: z.string().uuid() });

export const getShopMachine = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => GetMachineInput.parse(d))
  .handler(async ({ data, context }) => {
    return withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.shop_machines WHERE id = $1`,
        [data.id],
      );
      return rows[0] ? mapMachine(rows[0] as Record<string, unknown>) : null;
    });
  });

export const createShopMachine = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => MachineWrite.parse(d))
  .handler(async ({ data, context }) => {
    return withUser(context.userId, async (client) => {
      try {
        const { rows } = await client.query(
          `INSERT INTO public.shop_machines
             (organization_id, facility_id, asset_id, name, make, model, control, protocol, location)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING *`,
          [
            data.organizationId,
            data.facilityId,
            data.assetId.trim(),
            data.name.trim(),
            data.make.trim(),
            data.model.trim(),
            data.control,
            data.protocol,
            data.location?.trim() || null,
          ],
        );
        return mapMachine(rows[0] as Record<string, unknown>);
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "";
        if (code === "23505") {
          throw new Error(
            "A machine with that asset ID already exists in this facility.",
          );
        }
        throw error;
      }
    });
  });

const UpdateMachineInput = MachineWrite.extend({ id: z.string().uuid() }).omit({
  organizationId: true,
  facilityId: true,
});

export const updateShopMachine = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    UpdateMachineInput.extend({
      connectionStatus: z.enum(CONNECTION_STATUSES).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.connectionStatus === "live") {
      throw new Error(
        "Live machine connections are not implemented. Use not_connected or manual.",
      );
    }
    return withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `UPDATE public.shop_machines
            SET asset_id = $2, name = $3, make = $4, model = $5,
                control = $6, protocol = $7, location = $8,
                connection_status = COALESCE($9::public.shop_machine_connection, connection_status)
          WHERE id = $1
          RETURNING *`,
        [
          data.id,
          data.assetId.trim(),
          data.name.trim(),
          data.make.trim(),
          data.model.trim(),
          data.control,
          data.protocol,
          data.location?.trim() || null,
          data.connectionStatus ?? null,
        ],
      );
      if (!rows[0]) throw new Error("Machine not found or not accessible.");
      return mapMachine(rows[0] as Record<string, unknown>);
    });
  });

const DeleteMachineInput = z.object({ id: z.string().uuid() });

export const deleteShopMachine = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => DeleteMachineInput.parse(d))
  .handler(async ({ data, context }) => {
    await withUser(context.userId, (client) =>
      client.query(`DELETE FROM public.shop_machines WHERE id = $1`, [data.id]),
    );
  });

const ListRunsInput = z.object({ machineId: z.string().uuid() });

export const listMachineRuns = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ListRunsInput.parse(d))
  .handler(async ({ data, context }) => {
    return withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.shop_machine_run_events
          WHERE machine_id = $1
          ORDER BY occurred_at DESC`,
        [data.machineId],
      );
      return rows.map((row) => mapRun(row as Record<string, unknown>));
    });
  });

const CreateRunInput = z.object({
  machineId: z.string().uuid(),
  occurredAt: z.string().min(1),
  partNumber: z.string().min(1),
  cycles: z.number().nonnegative(),
  runtimeMinutes: z.number().nonnegative(),
  idleMinutes: z.number().nonnegative(),
  downtimeMinutes: z.number().nonnegative(),
  source: z.enum(["manual", "csv"]).default("manual"),
});

async function insertRun(
  userId: string,
  data: z.infer<typeof CreateRunInput>,
): Promise<MachineRunEvent> {
  const occurred = new Date(data.occurredAt);
  if (Number.isNaN(occurred.getTime())) {
    throw new Error("timestamp is not a valid date");
  }
  return withUser(userId, async (client) => {
    const machine = await client.query<{
      organization_id: string;
      facility_id: string;
    }>(
      `SELECT organization_id, facility_id FROM public.shop_machines WHERE id = $1`,
      [data.machineId],
    );
    if (!machine.rows[0])
      throw new Error("Machine not found or not accessible.");
    const { rows } = await client.query(
      `INSERT INTO public.shop_machine_run_events
         (machine_id, organization_id, facility_id, occurred_at, part_number,
          cycles, runtime_minutes, idle_minutes, downtime_minutes, source, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        data.machineId,
        machine.rows[0].organization_id,
        machine.rows[0].facility_id,
        occurred.toISOString(),
        data.partNumber.trim(),
        data.cycles,
        data.runtimeMinutes,
        data.idleMinutes,
        data.downtimeMinutes,
        data.source,
        userId,
      ],
    );
    await client.query(
      `UPDATE public.shop_machines
          SET connection_status = 'manual'
        WHERE id = $1 AND connection_status = 'not_connected'`,
      [data.machineId],
    );
    return mapRun(rows[0] as Record<string, unknown>);
  });
}

export const createMachineRun = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => CreateRunInput.parse(d))
  .handler(async ({ data, context }) => insertRun(context.userId, data));

const ImportCsvInput = z.object({
  machineId: z.string().uuid(),
  csvText: z.string().min(1),
});

export const importMachineRunsCsv = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ImportCsvInput.parse(d))
  .handler(async ({ data, context }) => {
    const parsed = parseRunCsv(data.csvText);
    const inserted: MachineRunEvent[] = [];
    for (const row of parsed) {
      inserted.push(
        await insertRun(context.userId, {
          machineId: data.machineId,
          occurredAt: row.occurred_at,
          partNumber: row.part_number,
          cycles: row.cycles,
          runtimeMinutes: row.runtime_minutes,
          idleMinutes: row.idle_minutes,
          downtimeMinutes: row.downtime_minutes,
          source: "csv",
        }),
      );
    }
    return { imported: inserted.length };
  });

const ListPartsInput = z.object({
  organizationId: z.string().uuid(),
  facilityId: z.string().uuid().optional(),
});

export const listShopParts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ListPartsInput.parse(d))
  .handler(async ({ data, context }) => {
    return withUser(context.userId, async (client) => {
      const { rows } = data.facilityId
        ? await client.query(
            `SELECT * FROM public.shop_parts
              WHERE organization_id = $1
                AND (facility_id = $2 OR facility_id IS NULL)
              ORDER BY part_number`,
            [data.organizationId, data.facilityId],
          )
        : await client.query(
            `SELECT * FROM public.shop_parts
              WHERE organization_id = $1
              ORDER BY part_number`,
            [data.organizationId],
          );
      return rows.map((row) => mapShopPart(row as Record<string, unknown>));
    });
  });

const UpsertPartInput = z.object({
  organizationId: z.string().uuid(),
  facilityId: z.string().uuid().optional(),
  partNumber: z.string().min(1),
  description: z.string().optional(),
  drawingRef: z.string().optional(),
});

export const upsertShopPartRecord = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => UpsertPartInput.parse(d))
  .handler(async ({ data, context }) => {
    return withUser(context.userId, (client) =>
      upsertShopPart(client, {
        organizationId: data.organizationId,
        facilityId: data.facilityId,
        partNumber: data.partNumber,
        description: data.description,
        drawingRef: data.drawingRef,
      }),
    );
  });

const MetricsInput = z.object({
  cycleTimeSecBefore: z.number().nonnegative(),
  cycleTimeSecAfter: z.number().nonnegative(),
  setupMinBefore: z.number().nonnegative(),
  setupMinAfter: z.number().nonnegative(),
  hoursOnPartBefore: z.number().nonnegative(),
  hoursOnPartAfter: z.number().nonnegative(),
  partsPerShiftBefore: z.number().nonnegative().nullable().optional(),
  partsPerShiftAfter: z.number().nonnegative().nullable().optional(),
  downtimeMinBefore: z.number().nonnegative().nullable().optional(),
  downtimeMinAfter: z.number().nonnegative().nullable().optional(),
  beforeAt: z.string().optional(),
  afterAt: z.string().optional(),
});

const SaveCardInput = MetricsInput.extend({
  organizationId: z.string().uuid(),
  facilityId: z.string().uuid().optional(),
  partNumber: z.string().min(1),
  partDescription: z.string().optional(),
  drawingRef: z.string().optional(),
  machineId: z.string().uuid().nullable().optional(),
  cncChangeLogId: z.string().uuid().optional(),
  capabilityActionId: z.string().uuid().optional(),
  whatChanged: z.string().min(1),
  id: z.string().uuid().optional(),
});

export const savePartOutcomeCard = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SaveCardInput.parse(d))
  .handler(async ({ data, context }) => {
    return withUser(context.userId, async (client) => {
      const part = await upsertShopPart(client, {
        organizationId: data.organizationId,
        facilityId: data.facilityId,
        partNumber: data.partNumber,
        description: data.partDescription,
        drawingRef: data.drawingRef,
      });
      const params = [
        data.organizationId,
        data.facilityId ?? null,
        part.id,
        data.machineId ?? null,
        data.cncChangeLogId ?? null,
        data.capabilityActionId ?? null,
        data.whatChanged.trim(),
        data.cycleTimeSecBefore,
        data.cycleTimeSecAfter,
        data.setupMinBefore,
        data.setupMinAfter,
        data.hoursOnPartBefore,
        data.hoursOnPartAfter,
        data.partsPerShiftBefore ?? null,
        data.partsPerShiftAfter ?? null,
        data.downtimeMinBefore ?? null,
        data.downtimeMinAfter ?? null,
        data.beforeAt || null,
        data.afterAt || null,
        context.userId,
      ];
      const { rows } = data.id
        ? await client.query(
            `UPDATE public.part_outcome_cards SET
               part_id = $3, machine_id = $4, cnc_change_log_id = COALESCE($5, cnc_change_log_id),
               capability_action_id = COALESCE($6, capability_action_id),
               what_changed = $7,
               cycle_time_sec_before = $8, cycle_time_sec_after = $9,
               setup_min_before = $10, setup_min_after = $11,
               hours_on_part_before = $12, hours_on_part_after = $13,
               parts_per_shift_before = $14, parts_per_shift_after = $15,
               downtime_min_before = $16, downtime_min_after = $17,
               before_at = $18, after_at = $19
             WHERE id = $21
             RETURNING id`,
            [...params, data.id],
          )
        : await client.query(
            `INSERT INTO public.part_outcome_cards
               (organization_id, facility_id, part_id, machine_id, cnc_change_log_id,
                capability_action_id, what_changed,
                cycle_time_sec_before, cycle_time_sec_after,
                setup_min_before, setup_min_after,
                hours_on_part_before, hours_on_part_after,
                parts_per_shift_before, parts_per_shift_after,
                downtime_min_before, downtime_min_after,
                before_at, after_at, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
             RETURNING id`,
            params,
          );
      const { rows: cards } = await client.query(
        `${PART_CARD_SELECT} WHERE c.id = $1`,
        [rows[0].id],
      );
      return mapPartCard(cards[0] as Record<string, unknown>);
    });
  });

const ListCardsInput = z.object({
  organizationId: z.string().uuid(),
  facilityId: z.string().uuid().optional(),
});

export const listPartOutcomeCards = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ListCardsInput.parse(d))
  .handler(async ({ data, context }) => {
    return withUser(context.userId, async (client) => {
      const { rows } = data.facilityId
        ? await client.query(
            `${PART_CARD_SELECT}
              WHERE c.organization_id = $1
                AND (c.facility_id = $2 OR c.facility_id IS NULL)
              ORDER BY c.created_at DESC`,
            [data.organizationId, data.facilityId],
          )
        : await client.query(
            `${PART_CARD_SELECT}
              WHERE c.organization_id = $1
              ORDER BY c.created_at DESC`,
            [data.organizationId],
          );
      return rows.map((row) => mapPartCard(row as Record<string, unknown>));
    });
  });
