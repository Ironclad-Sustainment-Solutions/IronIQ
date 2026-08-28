/**
 * Org-scoped CRUD for the plant program → part map.
 * Write access is the same as the rest of shop-floor: signed-in + RLS.
 */

import { createServerFn } from "@tanstack/react-start";
import type { PoolClient } from "pg";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import {
  assertCanWriteProgramPart,
  findOverlappingMapping,
} from "@/lib/machine-program-parts";
import { mapMachineProgramPart } from "@/lib/shop-floor.server";

const ListInput = z.object({
  organizationId: z.string().uuid(),
  plantId: z.string().uuid(),
});

export const listMachineProgramParts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ListInput.parse(d))
  .handler(async ({ data, context }) => {
    return withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.shop_machine_program_parts
          WHERE organization_id = $1 AND plant_id = $2
          ORDER BY program_name, valid_from DESC`,
        [data.organizationId, data.plantId],
      );
      return rows.map((row) =>
        mapMachineProgramPart(row as Record<string, unknown>),
      );
    });
  });

const SaveInput = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  plantId: z.string().uuid(),
  programName: z.string().min(1),
  partId: z.string().min(1),
  validFrom: z.string().min(1),
  validTo: z.string().nullable().optional(),
});

async function loadPlantOrganizationId(
  client: PoolClient,
  plantId: string,
): Promise<string | null> {
  const { rows } = await client.query<{ organization_id: string }>(
    `SELECT organization_id FROM public.facilities WHERE id = $1`,
    [plantId],
  );
  return rows[0]?.organization_id ?? null;
}

function parseWindow(validFrom: string, validTo?: string | null) {
  const from = new Date(validFrom);
  if (Number.isNaN(from.getTime())) {
    throw new Error("valid_from is not a valid date");
  }
  const toRaw = validTo?.trim() ? validTo : null;
  const to = toRaw ? new Date(toRaw) : null;
  if (to && Number.isNaN(to.getTime())) {
    throw new Error("valid_to is not a valid date");
  }
  if (to && to.getTime() <= from.getTime()) {
    throw new Error("valid_to must be after valid_from");
  }
  return {
    validFrom: from.toISOString(),
    validTo: to ? to.toISOString() : null,
  };
}

export const saveMachineProgramPart = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data, context }) => {
    const programName = data.programName.trim();
    const partId = data.partId.trim();
    const window = parseWindow(data.validFrom, data.validTo);
    return withUser(context.userId, async (client) => {
      const facilityOrganizationId = await loadPlantOrganizationId(
        client,
        data.plantId,
      );
      const organizationId = assertCanWriteProgramPart({
        requestedOrganizationId: data.organizationId,
        facilityOrganizationId,
      });

      const { rows: existingRows } = await client.query(
        `SELECT * FROM public.shop_machine_program_parts
          WHERE organization_id = $1 AND plant_id = $2 AND program_name = $3`,
        [organizationId, data.plantId, programName],
      );
      const existing = existingRows.map((row) =>
        mapMachineProgramPart(row as Record<string, unknown>),
      );
      const overlap = findOverlappingMapping(existing, {
        id: data.id,
        plant_id: data.plantId,
        program_name: programName,
        part_id: partId,
        valid_from: window.validFrom,
        valid_to: window.validTo,
      });
      if (overlap) {
        throw new Error(
          "Overlapping validity window for the same plant and program.",
        );
      }

      try {
        const { rows } = data.id
          ? await client.query(
              `UPDATE public.shop_machine_program_parts
                  SET program_name = $3, part_id = $4,
                      valid_from = $5, valid_to = $6
                WHERE id = $1 AND organization_id = $2 AND plant_id = $7
                RETURNING *`,
              [
                data.id,
                organizationId,
                programName,
                partId,
                window.validFrom,
                window.validTo,
                data.plantId,
              ],
            )
          : await client.query(
              `INSERT INTO public.shop_machine_program_parts
                 (organization_id, facility_id, plant_id, program_name, part_id,
                  valid_from, valid_to, created_by)
               VALUES ($1,$2,$2,$3,$4,$5,$6,$7)
               RETURNING *`,
              [
                organizationId,
                data.plantId,
                programName,
                partId,
                window.validFrom,
                window.validTo,
                context.userId,
              ],
            );
        if (!rows[0]) {
          throw new Error("Mapping not found or not accessible.");
        }
        return mapMachineProgramPart(rows[0] as Record<string, unknown>);
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "";
        const message = error instanceof Error ? error.message : String(error);
        if (code === "23505" || /overlapping validity window/i.test(message)) {
          throw new Error(
            "Overlapping validity window for the same plant and program.",
          );
        }
        throw error;
      }
    });
  });

const DeleteInput = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
});

export const deleteMachineProgramPart = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => DeleteInput.parse(d))
  .handler(async ({ data, context }) => {
    await withUser(context.userId, async (client) => {
      const { rowCount } = await client.query(
        `DELETE FROM public.shop_machine_program_parts
          WHERE id = $1 AND organization_id = $2`,
        [data.id, data.organizationId],
      );
      if (!rowCount) {
        throw new Error("Mapping not found or not accessible.");
      }
    });
  });
