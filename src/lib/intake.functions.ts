/**
 * Bulk Intake: upload and text-extraction pipeline for the shared document
 * intake layer (see db/schema_additions_bulk_intake.sql). Mirrors the
 * existing evidence-upload pattern in field-capture-api.functions.ts
 * (a base64 upload through a server function, not a presigned-URL flow) —
 * that pattern is already proven out for the same S3-compatible storage
 * layer this reuses.
 *
 * This file only covers upload + extraction (Phase 2). AI synthesis
 * (per-document summarization and the three per-system mapping adapters)
 * is a separate phase, not started here.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import mammoth from "mammoth";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import ExcelJS from "exceljs";

import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import {
  uploadObject,
  getObjectBuffer,
  deleteObject,
} from "@/lib/storage.server";

export const INTAKE_BUCKET = "bulk-intake";

// Generous per-file cap so a live demo never hangs on something absurd, but
// generous enough not to bite a normal client-visit document dump.
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB

const IntakeCategory = z.enum([
  "evaluator_note",
  "company_documentation",
  "other",
]);

// ---------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------

const CreateIntakeUploadInput = z.object({
  organizationId: z.string().uuid(),
  facilityId: z.string().uuid(),
  fileName: z.string(),
  fileBase64: z.string(),
  contentType: z.string().optional(),
  category: IntakeCategory.default("other"),
});

export const createIntakeUpload = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => CreateIntakeUploadInput.parse(d))
  .handler(async ({ data, context }) => {
    const buffer = Buffer.from(data.fileBase64, "base64");
    if (buffer.byteLength > MAX_FILE_BYTES) {
      const mb = (n: number) => (n / (1024 * 1024)).toFixed(1);
      throw new Error(
        `"${data.fileName}" is ${mb(buffer.byteLength)}MB, over the ${mb(MAX_FILE_BYTES)}MB per-file Bulk Intake limit.`,
      );
    }

    const safeName = data.fileName
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .slice(-120);
    const path = `${data.facilityId}/${crypto.randomUUID()}-${safeName}`;
    await uploadObject(INTAKE_BUCKET, path, buffer, data.contentType);

    return withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO public.intake_documents
           (organization_id, facility_id, uploaded_by, original_filename, mime_type, byte_size, storage_path, category, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'uploaded')
         RETURNING id`,
        [
          data.organizationId,
          data.facilityId,
          context.userId,
          data.fileName.slice(0, 300),
          data.contentType ?? null,
          buffer.byteLength,
          path,
          data.category,
        ],
      );
      return { documentId: rows[0].id as string, path };
    });
  });

// ---------------------------------------------------------------------
// Listing — drives per-file progress in the Bulk Intake UI (Phase 4)
// ---------------------------------------------------------------------

const ListIntakeDocumentsInput = z.object({ facilityId: z.string().uuid() });

export const listIntakeDocuments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ListIntakeDocumentsInput.parse(d))
  .handler(async ({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `SELECT id, original_filename, mime_type, byte_size, category, status, failure_reason,
                storage_path, created_at
           FROM public.intake_documents
          WHERE facility_id = $1
          ORDER BY created_at DESC`,
        [data.facilityId],
      );
      return rows;
    }),
  );

// ---------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------

type ExtractionMethod = "pdf" | "docx" | "xlsx" | "text";

function inferExtractionMethod(
  mimeType: string | null,
  fileName: string,
): ExtractionMethod | "image" | "unsupported" {
  const name = fileName.toLowerCase();
  const mime = (mimeType ?? "").toLowerCase();
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (mime.includes("wordprocessingml") || name.endsWith(".docx"))
    return "docx";
  if (
    mime.includes("spreadsheetml") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".csv")
  ) {
    return "xlsx";
  }
  if (mime.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md"))
    return "text";
  if (mime.startsWith("image/")) return "image";
  return "unsupported";
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const doc = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractPdfText(doc, { mergePages: true });
  return text;
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractSpreadsheet(
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  // CSV is plain text — no workbook parsing needed, and ExcelJS's CSV reader
  // wants a stream rather than a buffer, so handle it directly.
  if (fileName.toLowerCase().endsWith(".csv")) {
    return buffer.toString("utf8");
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const lines: string[] = [];
  workbook.eachSheet((sheet) => {
    lines.push(`--- Sheet: ${sheet.name} ---`);
    sheet.eachRow((row) => {
      const values = row.values as unknown[];
      // row.values is 1-indexed (index 0 is always empty) per ExcelJS's API.
      const cells = values.slice(1).map((v) => (v == null ? "" : String(v)));
      lines.push(cells.join("\t"));
    });
  });
  return lines.join("\n");
}

async function extractText(
  method: ExtractionMethod,
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  switch (method) {
    case "pdf":
      return extractPdf(buffer);
    case "docx":
      return extractDocx(buffer);
    case "xlsx":
      return extractSpreadsheet(buffer, fileName);
    case "text":
      return buffer.toString("utf8");
  }
}

const ParseIntakeDocumentInput = z.object({ documentId: z.string().uuid() });

export const parseIntakeDocument = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ParseIntakeDocumentInput.parse(d))
  .handler(async ({ data, context }) => {
    const doc = await withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `SELECT id, storage_path, mime_type, original_filename
           FROM public.intake_documents WHERE id = $1`,
        [data.documentId],
      );
      if (rows.length === 0)
        throw new Error("Document not found or not accessible.");
      await client.query(
        `UPDATE public.intake_documents SET status = 'parsing' WHERE id = $1`,
        [data.documentId],
      );
      return rows[0] as {
        id: string;
        storage_path: string;
        mime_type: string | null;
        original_filename: string;
      };
    });

    const method = inferExtractionMethod(doc.mime_type, doc.original_filename);

    // Images: stored as evidence, deliberately not text-extracted (no OCR
    // configured for this feature) — a valid end state, not a failure.
    if (method === "image") {
      await withUser(context.userId, (client) =>
        client.query(
          `UPDATE public.intake_documents SET status = 'parsed' WHERE id = $1`,
          [data.documentId],
        ),
      );
      return {
        skipped: true,
        reason: "Image — stored as evidence, not text-extracted.",
      };
    }

    if (method === "unsupported") {
      const reason = `Unrecognized file type for "${doc.original_filename}".`;
      await withUser(context.userId, (client) =>
        client.query(
          `UPDATE public.intake_documents SET status = 'failed', failure_reason = $2 WHERE id = $1`,
          [data.documentId, reason],
        ),
      );
      throw new Error(reason);
    }

    try {
      const buffer = await getObjectBuffer(INTAKE_BUCKET, doc.storage_path);
      const text = await extractText(method, buffer, doc.original_filename);

      return await withUser(context.userId, async (client) => {
        const { rows } = await client.query(
          `INSERT INTO public.intake_extractions (document_id, extraction_method, extracted_text, token_count_estimate)
           VALUES ($1,$2,$3,$4) RETURNING id`,
          [data.documentId, method, text, Math.ceil(text.length / 4)],
        );
        await client.query(
          `UPDATE public.intake_documents SET status = 'parsed' WHERE id = $1`,
          [data.documentId],
        );
        return { extractionId: rows[0].id as string, characters: text.length };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await withUser(context.userId, (client) =>
        client.query(
          `UPDATE public.intake_documents SET status = 'failed', failure_reason = $2 WHERE id = $1`,
          [data.documentId, message.slice(0, 500)],
        ),
      );
      throw error;
    }
  });

// ---------------------------------------------------------------------
// Suggestion review — list and accept/edit/reject. Applying an accepted
// suggestion's value into its real downstream table (assessment_responses,
// cap_problems, field_gaps, etc.) is intentionally NOT done here — that's
// a separate, per-system write path with its own upsert semantics, not
// yet built. Accepting here only marks intake_field_suggestions.status;
// see the Phase 4 PR description for why that line was drawn here.
// ---------------------------------------------------------------------

const ListSuggestionsInput = z.object({
  facilityId: z.string().uuid(),
  targetSystem: z
    .enum(["template_assessment", "cap_assessment", "field_assessment"])
    .optional(),
});

export const listIntakeSuggestions = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ListSuggestionsInput.parse(d))
  .handler(async ({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `SELECT s.id, s.target_system, s.template_assessment_id, s.cap_assessment_id, s.field_assessment_id,
                s.target_field_path, s.suggested_value, s.confidence, s.source_document_ids, s.status, s.created_at,
                (SELECT array_agg(d.original_filename ORDER BY d.original_filename)
                   FROM public.intake_documents d
                  WHERE d.id = ANY(s.source_document_ids)) AS source_document_names
           FROM public.intake_field_suggestions s
          WHERE s.facility_id = $1
            AND ($2::public.intake_target_system IS NULL OR s.target_system = $2)
          ORDER BY s.created_at DESC`,
        [data.facilityId, data.targetSystem ?? null],
      );
      return rows;
    }),
  );

const UpdateSuggestionStatusInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["accepted", "edited", "rejected"]),
  editedValue: z.string().optional(),
});

export const updateIntakeSuggestionStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => UpdateSuggestionStatusInput.parse(d))
  .handler(async ({ data, context }) =>
    withUser(context.userId, async (client) => {
      if (data.status === "edited" && data.editedValue !== undefined) {
        await client.query(
          `UPDATE public.intake_field_suggestions
              SET status = $2, suggested_value = $3, reviewed_by = $4
            WHERE id = $1`,
          [data.id, data.status, data.editedValue, context.userId],
        );
      } else {
        await client.query(
          `UPDATE public.intake_field_suggestions SET status = $2, reviewed_by = $3 WHERE id = $1`,
          [data.id, data.status, context.userId],
        );
      }
    }),
  );

const DeleteIntakeDocumentInput = z.object({
  id: z.string().uuid(),
});

export const deleteIntakeDocument = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => DeleteIntakeDocumentInput.parse(d))
  .handler(async ({ data, context }) => {
    // Previously took `storagePath` as its own client-supplied field and
    // deleted it from S3 with NO check at all -- not even requireAuth
    // beyond "logged in somehow," no org-scoping, nothing tying the path
    // to `id`. Any authenticated user could delete any object in the
    // bulk-intake bucket, from any organization, by just supplying a
    // path string. Fixed by resolving the real storage_path server-side,
    // under the caller's own RLS-scoped role, before deleting anything --
    // if RLS wouldn't let them see this row, nothing gets deleted.
    const storagePath = await withUser(context.userId, async (client) => {
      const { rows } = await client.query<{ storage_path: string }>(
        `SELECT storage_path FROM public.intake_documents WHERE id = $1`,
        [data.id],
      );
      return rows[0]?.storage_path ?? null;
    });
    if (!storagePath) throw new Error("Document not found or not accessible.");
    await deleteObject(INTAKE_BUCKET, storagePath);
    // ON DELETE CASCADE removes any intake_extractions row automatically.
    // Any intake_field_suggestions referencing this document via
    // source_document_ids (a plain array, not an FK — see schema notes)
    // are NOT auto-cleaned by this. That's a Phase 3/5 concern once
    // suggestions actually exist; flagging here so it isn't forgotten.
    await withUser(context.userId, (client) =>
      client.query(`DELETE FROM public.intake_documents WHERE id = $1`, [
        data.id,
      ]),
    );
  });
