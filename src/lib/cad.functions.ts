/**
 * CAD Conversion — raster path (Phase E). Mirrors intake.functions.ts's
 * proven upload/status/review shape rather than inventing a new one.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import {
  uploadObject,
  getObjectBuffer,
  deleteObject,
} from "@/lib/storage.server";
import { extractCadFields } from "@/lib/cad-vision-ai.server";
import {
  assertProductAllowed,
  assertProductAllowedForCadJob,
  assertProductAllowedForCadField,
} from "@/lib/product-access-check.server";
import { upsertShopPart } from "@/lib/shop-floor.server";
import { looksLikePartNumberField } from "@/lib/shop-floor";

export const CAD_BUCKET = "cad-drawings";
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB, same cap as Bulk Intake

const CreateCadJobInput = z.object({
  organizationId: z.string().uuid(),
  facilityId: z.string().uuid().nullable().optional(),
  fileName: z.string(),
  fileBase64: z.string(),
  contentType: z.string().optional(),
});

export const createCadJob = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => CreateCadJobInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertProductAllowed(context.userId, data.organizationId, "cad");

    const buffer = Buffer.from(data.fileBase64, "base64");
    if (buffer.byteLength > MAX_FILE_BYTES) {
      const mb = (n: number) => (n / (1024 * 1024)).toFixed(1);
      throw new Error(
        `"${data.fileName}" is ${mb(buffer.byteLength)}MB, over the ${mb(MAX_FILE_BYTES)}MB limit.`,
      );
    }

    const safeName = data.fileName
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .slice(-120);
    const path = `${data.organizationId}/${crypto.randomUUID()}-${safeName}`;
    await uploadObject(CAD_BUCKET, path, buffer, data.contentType);

    return withUser(context.userId, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO public.cad_jobs
           (organization_id, facility_id, uploaded_by, original_filename, mime_type, byte_size, storage_path, source_type, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'raster','uploaded')
         RETURNING id`,
        [
          data.organizationId,
          data.facilityId ?? null,
          context.userId,
          data.fileName.slice(0, 300),
          data.contentType ?? null,
          buffer.byteLength,
          path,
        ],
      );
      return { jobId: rows[0].id, path };
    });
  });

const ListCadJobsInput = z.object({ organizationId: z.string().uuid() });

export const listCadJobs = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ListCadJobsInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertProductAllowed(context.userId, data.organizationId, "cad");
    return withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `SELECT id, original_filename, mime_type, byte_size, source_type, status, failure_reason,
                storage_path, part_number, part_id, created_at
           FROM public.cad_jobs
          WHERE organization_id = $1
          ORDER BY created_at DESC`,
        [data.organizationId],
      );
      return rows;
    });
  });

const ExtractCadJobInput = z.object({ jobId: z.string().uuid() });

export const extractCadJob = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ExtractCadJobInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertProductAllowedForCadJob(context.userId, data.jobId, "cad");
    const job = await withUser(context.userId, async (client) => {
      const { rows } = await client.query<{
        storage_path: string;
        mime_type: string | null;
      }>(`SELECT storage_path, mime_type FROM public.cad_jobs WHERE id = $1`, [
        data.jobId,
      ]);
      if (rows.length === 0)
        throw new Error("Job not found or not accessible.");
      await client.query(
        `UPDATE public.cad_jobs SET status = 'processing' WHERE id = $1`,
        [data.jobId],
      );
      return rows[0];
    });

    if (!job.mime_type || !job.mime_type.startsWith("image/")) {
      const reason =
        "The raster extraction path only handles image files (scanned/photographed drawings) today.";
      await withUser(context.userId, (client) =>
        client.query(
          `UPDATE public.cad_jobs SET status = 'failed', failure_reason = $2 WHERE id = $1`,
          [data.jobId, reason],
        ),
      );
      throw new Error(reason);
    }

    try {
      const buffer = await getObjectBuffer(CAD_BUCKET, job.storage_path);
      const fields = await extractCadFields(
        buffer.toString("base64"),
        job.mime_type,
      );

      return await withUser(context.userId, async (client) => {
        for (const f of fields) {
          await client.query(
            `INSERT INTO public.cad_extracted_fields
               (job_id, field_type, field_name, field_value, location_hint, confidence)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [
              data.jobId,
              f.field_type,
              f.field_name,
              f.field_value,
              f.location_hint,
              f.confidence,
            ],
          );
        }
        await client.query(
          `UPDATE public.cad_jobs SET status = 'extracted' WHERE id = $1`,
          [data.jobId],
        );
        return { fieldsExtracted: fields.length };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await withUser(context.userId, (client) =>
        client.query(
          `UPDATE public.cad_jobs SET status = 'failed', failure_reason = $2 WHERE id = $1`,
          [data.jobId, message.slice(0, 500)],
        ),
      );
      throw error;
    }
  });

const ListCadFieldsInput = z.object({ jobId: z.string().uuid() });

export const listCadFields = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ListCadFieldsInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertProductAllowedForCadJob(context.userId, data.jobId, "cad");
    return withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `SELECT id, field_type, field_name, field_value, location_hint, confidence, status, created_at
           FROM public.cad_extracted_fields
          WHERE job_id = $1
          ORDER BY created_at ASC`,
        [data.jobId],
      );
      return rows;
    });
  });

const UpdateCadFieldInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["accepted", "edited", "rejected"]),
  editedValue: z.string().optional(),
  editedFieldName: z.string().optional(),
  editedFieldType: z
    .enum([
      "title_block",
      "dimension",
      "tolerance",
      "gdt",
      "note",
      "material",
      "other",
    ])
    .optional(),
  editedLocationHint: z.string().optional(),
});

export const updateCadFieldStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => UpdateCadFieldInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertProductAllowedForCadField(context.userId, data.id, "cad");
    await withUser(context.userId, async (client) => {
      if (data.status === "edited" && data.editedValue !== undefined) {
        await client.query(
          `UPDATE public.cad_extracted_fields
              SET status = $2, field_value = $3, field_name = COALESCE($4, field_name),
                  field_type = COALESCE($5, field_type), location_hint = COALESCE($6, location_hint),
                  reviewed_by = $7
            WHERE id = $1`,
          [
            data.id,
            data.status,
            data.editedValue,
            data.editedFieldName ?? null,
            data.editedFieldType ?? null,
            data.editedLocationHint ?? null,
            context.userId,
          ],
        );
      } else {
        await client.query(
          `UPDATE public.cad_extracted_fields SET status = $2, reviewed_by = $3 WHERE id = $1`,
          [data.id, data.status, context.userId],
        );
      }

      if (data.status === "accepted" || data.status === "edited") {
        const { rows } = await client.query<{
          field_name: string;
          field_value: string;
          job_id: string;
          organization_id: string;
          facility_id: string | null;
        }>(
          `SELECT f.field_name, f.field_value, f.job_id, j.organization_id, j.facility_id
             FROM public.cad_extracted_fields f
             JOIN public.cad_jobs j ON j.id = f.job_id
            WHERE f.id = $1`,
          [data.id],
        );
        const field = rows[0];
        if (field && looksLikePartNumberField(field.field_name)) {
          const part = await upsertShopPart(client, {
            organizationId: field.organization_id,
            facilityId: field.facility_id,
            partNumber: field.field_value,
          });
          await client.query(
            `UPDATE public.cad_jobs
                SET part_number = $2, part_id = $3
              WHERE id = $1`,
            [field.job_id, part.part_number, part.id],
          );
        }
      }
    });
  });

const DeleteCadJobInput = z.object({
  id: z.string().uuid(),
});

export const deleteCadJob = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => DeleteCadJobInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertProductAllowedForCadJob(context.userId, data.id, "cad");
    // Resolve the real storage_path server-side, under RLS, rather than
    // trusting a client-supplied path -- that was a real arbitrary-file-
    // deletion vulnerability: the input previously took `storagePath` as
    // its own separate field, entirely unverified against `id`, so a
    // client could pass a legitimate job of their own (satisfying the
    // product-restriction/RLS check above) alongside ANY other path
    // string and have that arbitrary S3 object deleted instead.
    const storagePath = await withUser(context.userId, async (client) => {
      const { rows } = await client.query<{ storage_path: string }>(
        `SELECT storage_path FROM public.cad_jobs WHERE id = $1`,
        [data.id],
      );
      return rows[0]?.storage_path ?? null;
    });
    if (!storagePath) throw new Error("Job not found or not accessible.");
    await deleteObject(CAD_BUCKET, storagePath);
    await withUser(context.userId, (client) =>
      client.query(`DELETE FROM public.cad_jobs WHERE id = $1`, [data.id]),
    );
  });
