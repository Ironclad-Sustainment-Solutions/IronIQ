import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";

export interface Supplier {
  id: string;
  organization_id: string;
  facility_id: string | null;
  name: string;
  category: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  lead_time_days: number | null;
  quality_notes: string | null;
  status: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

function mapSupplier(row: Record<string, unknown>): Supplier {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    facility_id: row.facility_id == null ? null : String(row.facility_id),
    name: String(row.name),
    category: row.category == null ? null : String(row.category),
    primary_contact_name:
      row.primary_contact_name == null
        ? null
        : String(row.primary_contact_name),
    primary_contact_email:
      row.primary_contact_email == null
        ? null
        : String(row.primary_contact_email),
    primary_contact_phone:
      row.primary_contact_phone == null
        ? null
        : String(row.primary_contact_phone),
    lead_time_days:
      row.lead_time_days == null ? null : Number(row.lead_time_days),
    quality_notes: row.quality_notes == null ? null : String(row.quality_notes),
    status: String(row.status),
    archived: Boolean(row.archived),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

const ListInput = z.object({ organizationId: z.string().uuid() });

export const listSuppliers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ListInput.parse(d))
  .handler(async ({ data, context }) => {
    return withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.suppliers
          WHERE organization_id = $1 AND archived = false
          ORDER BY name`,
        [data.organizationId],
      );
      return rows.map((r) => mapSupplier(r as Record<string, unknown>));
    });
  });

const SupplierWrite = z.object({
  organizationId: z.string().uuid(),
  facilityId: z.string().uuid().optional(),
  name: z.string().min(1),
  category: z.string().optional(),
  primaryContactName: z.string().optional(),
  primaryContactEmail: z.string().email().optional().or(z.literal("")),
  primaryContactPhone: z.string().optional(),
  leadTimeDays: z.number().int().min(0).optional(),
  qualityNotes: z.string().optional(),
});

export const createSupplier = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SupplierWrite.parse(d))
  .handler(async ({ data, context }) => {
    return withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO public.suppliers
           (organization_id, facility_id, name, category, primary_contact_name,
            primary_contact_email, primary_contact_phone, lead_time_days, quality_notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          data.organizationId,
          data.facilityId ?? null,
          data.name.trim(),
          data.category?.trim() || null,
          data.primaryContactName?.trim() || null,
          data.primaryContactEmail?.trim() || null,
          data.primaryContactPhone?.trim() || null,
          data.leadTimeDays ?? null,
          data.qualityNotes?.trim() || null,
          context.userId,
        ],
      );
      return mapSupplier(rows[0] as Record<string, unknown>);
    });
  });

const UpdateSupplierInput = SupplierWrite.extend({ id: z.string().uuid() });

export const updateSupplier = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => UpdateSupplierInput.parse(d))
  .handler(async ({ data, context }) => {
    return withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `UPDATE public.suppliers
            SET facility_id = $2, name = $3, category = $4, primary_contact_name = $5,
                primary_contact_email = $6, primary_contact_phone = $7,
                lead_time_days = $8, quality_notes = $9
          WHERE id = $1
          RETURNING *`,
        [
          data.id,
          data.facilityId ?? null,
          data.name.trim(),
          data.category?.trim() || null,
          data.primaryContactName?.trim() || null,
          data.primaryContactEmail?.trim() || null,
          data.primaryContactPhone?.trim() || null,
          data.leadTimeDays ?? null,
          data.qualityNotes?.trim() || null,
        ],
      );
      if (!rows[0]) throw new Error("Supplier not found or not accessible.");
      return mapSupplier(rows[0] as Record<string, unknown>);
    });
  });

const ArchiveInput = z.object({ id: z.string().uuid() });

export const archiveSupplier = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ArchiveInput.parse(d))
  .handler(async ({ data, context }) => {
    await withUser(context.userId, (client) =>
      client.query(
        `UPDATE public.suppliers SET archived = true WHERE id = $1`,
        [data.id],
      ),
    );
  });
