/**
 * CNC Coding Enhancement — Phase F.1. Deliberately two-step: logging a
 * change is as low-friction as possible (machine, what changed, why),
 * and the outcome/verification is a separate later action once the
 * result is actually known — this is what the phased plan calls
 * "adoption-first": getting programmers to reliably log changes at all
 * is the real precondition for any AI value on top of this later.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import { captureFromCncChangeLog } from "@/lib/intelligence-capture.server";
import {
  assertProductAllowed,
  assertProductAllowedForCncLogEntry,
} from "@/lib/product-access-check.server";

const CHANGE_CATEGORIES = [
  "feed_speed",
  "toolpath",
  "fixture",
  "tooling",
  "program_logic",
  "other",
] as const;

const CreateCncLogInput = z.object({
  organizationId: z.string().uuid(),
  facilityId: z.string().uuid().nullable().optional(),
  machineId: z.string().uuid(),
  programIdentifier: z.string().optional(),
  changeCategory: z.enum(CHANGE_CATEGORIES),
  changeDescription: z.string().min(1),
  reason: z.string().min(1),
});

export const createCncChangeLogEntry = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => CreateCncLogInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertProductAllowed(context.userId, data.organizationId, "cnc");
    return withUser(context.userId, async (client) => {
      const machine = await client.query<{ name: string; asset_id: string }>(
        `SELECT name, asset_id FROM public.shop_machines WHERE id = $1`,
        [data.machineId],
      );
      if (!machine.rows[0]) {
        throw new Error("Select a machine from the machine master.");
      }
      const machineName = `${machine.rows[0].asset_id} — ${machine.rows[0].name}`;
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO public.cnc_change_log
           (organization_id, facility_id, machine_id, machine_name, program_identifier, change_category,
            change_description, reason, logged_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [
          data.organizationId,
          data.facilityId ?? null,
          data.machineId,
          machineName,
          data.programIdentifier ?? null,
          data.changeCategory,
          data.changeDescription,
          data.reason,
          context.userId,
        ],
      );
      return { id: rows[0].id };
    });
  });

const ListCncLogInput = z.object({ organizationId: z.string().uuid() });

export const listCncChangeLog = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ListCncLogInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertProductAllowed(context.userId, data.organizationId, "cnc");
    return withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `SELECT id, machine_id, machine_name, program_identifier, change_category, change_description, reason,
                outcome_description, status, created_at
           FROM public.cnc_change_log
          WHERE organization_id = $1
          ORDER BY created_at DESC`,
        [data.organizationId],
      );
      return rows;
    });
  });

const VerifyCncLogInput = z.object({
  id: z.string().uuid(),
  outcomeDescription: z.string().min(1),
  contributeToIntelligence: z.boolean().optional(),
});

export const verifyCncChangeLogEntry = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => VerifyCncLogInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertProductAllowedForCncLogEntry(context.userId, data.id, "cnc");
    await withUser(context.userId, (client) =>
      client.query(
        `UPDATE public.cnc_change_log
            SET status = 'verified', outcome_description = $2, verified_by = $3, verified_at = now()
          WHERE id = $1`,
        [data.id, data.outcomeDescription, context.userId],
      ),
    );

    if (data.contributeToIntelligence) {
      await captureFromCncChangeLog(context.userId, data.id);
    }
  });

const DeleteCncLogInput = z.object({ id: z.string().uuid() });

export const deleteCncChangeLogEntry = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => DeleteCncLogInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertProductAllowedForCncLogEntry(context.userId, data.id, "cnc");
    await withUser(context.userId, (client) =>
      client.query(`DELETE FROM public.cnc_change_log WHERE id = $1`, [
        data.id,
      ]),
    );
  });

// Previously no way to fix a typo or correct the original log entry at
// all after creation — only the outcome could ever be set, once, via
// verifyCncChangeLogEntry. This is the general-purpose fix for that.
const UpdateCncLogInput = z.object({
  id: z.string().uuid(),
  machineId: z.string().uuid(),
  programIdentifier: z.string().optional(),
  changeCategory: z.enum(CHANGE_CATEGORIES),
  changeDescription: z.string().min(1),
  reason: z.string().min(1),
});

export const updateCncChangeLogEntry = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => UpdateCncLogInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertProductAllowedForCncLogEntry(context.userId, data.id, "cnc");
    await withUser(context.userId, async (client) => {
      const machine = await client.query<{ name: string; asset_id: string }>(
        `SELECT name, asset_id FROM public.shop_machines WHERE id = $1`,
        [data.machineId],
      );
      if (!machine.rows[0]) {
        throw new Error("Select a machine from the machine master.");
      }
      const machineName = `${machine.rows[0].asset_id} — ${machine.rows[0].name}`;
      await client.query(
        `UPDATE public.cnc_change_log
            SET machine_id = $2, machine_name = $3, program_identifier = $4, change_category = $5,
                change_description = $6, reason = $7
          WHERE id = $1`,
        [
          data.id,
          data.machineId,
          machineName,
          data.programIdentifier ?? null,
          data.changeCategory,
          data.changeDescription,
          data.reason,
        ],
      );
    });
  });
