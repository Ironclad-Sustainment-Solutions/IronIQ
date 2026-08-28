import type { PoolClient } from "pg";
import type { MachineProgramPart } from "@/lib/machine-program-parts";
import type { PartOutcomeCard, ShopPart } from "@/lib/shop-floor";

export function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function asIsoOrNull(value: unknown): string | null {
  if (value == null) return null;
  return asIso(value);
}

export function mapShopPart(row: Record<string, unknown>): ShopPart {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    facility_id: row.facility_id == null ? null : String(row.facility_id),
    part_number: String(row.part_number),
    description: row.description == null ? null : String(row.description),
    drawing_ref: row.drawing_ref == null ? null : String(row.drawing_ref),
  };
}

export function mapPartCard(row: Record<string, unknown>): PartOutcomeCard {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    facility_id: row.facility_id == null ? null : String(row.facility_id),
    part_id: String(row.part_id),
    machine_id: row.machine_id == null ? null : String(row.machine_id),
    cnc_change_log_id:
      row.cnc_change_log_id == null ? null : String(row.cnc_change_log_id),
    capability_action_id:
      row.capability_action_id == null
        ? null
        : String(row.capability_action_id),
    part_number: String(row.part_number),
    part_description:
      row.part_description == null ? null : String(row.part_description),
    drawing_ref: row.drawing_ref == null ? null : String(row.drawing_ref),
    machine_label: row.machine_label == null ? null : String(row.machine_label),
    what_changed: String(row.what_changed),
    cycle_time_sec_before: Number(row.cycle_time_sec_before),
    cycle_time_sec_after: Number(row.cycle_time_sec_after),
    setup_min_before: Number(row.setup_min_before),
    setup_min_after: Number(row.setup_min_after),
    hours_on_part_before: Number(row.hours_on_part_before),
    hours_on_part_after: Number(row.hours_on_part_after),
    parts_per_shift_before:
      row.parts_per_shift_before == null
        ? null
        : Number(row.parts_per_shift_before),
    parts_per_shift_after:
      row.parts_per_shift_after == null
        ? null
        : Number(row.parts_per_shift_after),
    downtime_min_before:
      row.downtime_min_before == null ? null : Number(row.downtime_min_before),
    downtime_min_after:
      row.downtime_min_after == null ? null : Number(row.downtime_min_after),
    before_at: asIsoOrNull(row.before_at),
    after_at: asIsoOrNull(row.after_at),
    created_at: asIso(row.created_at),
  };
}

export const PART_CARD_SELECT = `
  SELECT c.*,
         p.part_number,
         p.description AS part_description,
         p.drawing_ref,
         CASE
           WHEN m.id IS NULL THEN NULL
           ELSE m.asset_id || ' — ' || m.name
         END AS machine_label
    FROM public.part_outcome_cards c
    JOIN public.shop_parts p ON p.id = c.part_id
    LEFT JOIN public.shop_machines m ON m.id = c.machine_id
`;

export async function upsertShopPart(
  client: PoolClient,
  input: {
    organizationId: string;
    facilityId?: string | null;
    partNumber: string;
    description?: string | null;
    drawingRef?: string | null;
  },
): Promise<ShopPart> {
  const partNumber = input.partNumber.trim();
  if (!partNumber) throw new Error("Part number is required.");
  const { rows } = await client.query(
    `INSERT INTO public.shop_parts
       (organization_id, facility_id, part_number, description, drawing_ref)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (organization_id, part_number) DO UPDATE
       SET description = COALESCE(EXCLUDED.description, public.shop_parts.description),
           drawing_ref = COALESCE(EXCLUDED.drawing_ref, public.shop_parts.drawing_ref),
           facility_id = COALESCE(public.shop_parts.facility_id, EXCLUDED.facility_id)
     RETURNING *`,
    [
      input.organizationId,
      input.facilityId ?? null,
      partNumber,
      input.description?.trim() || null,
      input.drawingRef?.trim() || null,
    ],
  );
  return mapShopPart(rows[0] as Record<string, unknown>);
}

export function mapMachineProgramPart(
  row: Record<string, unknown>,
): MachineProgramPart {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    facility_id: String(row.facility_id),
    plant_id: String(row.plant_id),
    program_name: String(row.program_name),
    part_id: String(row.part_id),
    valid_from: asIso(row.valid_from),
    valid_to: asIsoOrNull(row.valid_to),
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
  };
}

/**
 * Plant + program + timestamp → part_id, or null if unmapped / expired.
 * Ingest (`POST /api/ironiq/v1/machine-events`) should call this on POST
 * and keep program_name with part_id=null when the lookup misses.
 */
export async function resolvePartId(
  client: PoolClient,
  plantId: string,
  programName: string,
  at: string | Date,
): Promise<string | null> {
  const occurred = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(occurred.getTime())) {
    throw new Error("timestamp is not a valid date");
  }
  const { rows } = await client.query<{ part_id: string }>(
    `SELECT public.resolve_part_id($1, $2, $3::timestamptz) AS part_id`,
    [plantId, programName.trim(), occurred.toISOString()],
  );
  return rows[0]?.part_id ?? null;
}
