/**
 * Server functions backing field-capture-api.ts's React Query hooks.
 * Each mutation/query used to run as a direct browser -> Supabase call
 * (RLS enforced client-side via the anon key); now it's a server function
 * that runs the same query server-side with RLS enforced via withUser().
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import {
  getSignedDownloadUrl,
  uploadObject,
  deleteObject,
} from "@/lib/storage.server";
import { assertColumnsAllowed } from "@/lib/column-allowlist";

export const EVIDENCE_BUCKET = "field-evidence";

const idInput = z.object({ id: z.string().uuid() });
const fieldIdInput = z.object({ fieldId: z.string().uuid() });

export const getFieldCapture = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => fieldIdInput.parse(d))
  .handler(async ({ data, context }) =>
    withUser(context.userId, async (client) => {
      const [observations, quickCaptures, attachments, gaps] =
        await Promise.all([
          client.query(
            "SELECT * FROM public.field_capture_observations WHERE field_assessment_id = $1 ORDER BY created_at DESC",
            [data.fieldId],
          ),
          client.query(
            "SELECT * FROM public.field_quick_captures WHERE field_assessment_id = $1 ORDER BY created_at DESC",
            [data.fieldId],
          ),
          client.query(
            "SELECT * FROM public.field_attachments WHERE field_assessment_id = $1",
            [data.fieldId],
          ),
          client.query(
            "SELECT * FROM public.field_gaps WHERE field_assessment_id = $1 ORDER BY sort_order",
            [data.fieldId],
          ),
        ]);
      return {
        observations: observations.rows,
        quickCaptures: quickCaptures.rows,
        attachments: attachments.rows,
        gaps: gaps.rows,
      };
    }),
  );

// ---- observations ----

const AddObservationInput = z.object({
  fieldId: z.string().uuid(),
  values: z.record(z.any()),
});

export const addObservation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => AddObservationInput.parse(d))
  .handler(async ({ data, context }) =>
    withUser(context.userId, async (client) => {
      const valueCols = Object.keys(data.values);
      assertColumnsAllowed("field_capture_observations", valueCols);
      const cols = ["field_assessment_id", ...valueCols, "created_by"];
      const vals = [
        data.fieldId,
        ...Object.values(data.values),
        context.userId,
      ];
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
      const { rows } = await client.query(
        `INSERT INTO public.field_capture_observations (${cols.join(", ")}) VALUES (${placeholders}) RETURNING id`,
        vals,
      );
      return rows[0].id as string;
    }),
  );

const UpdateRowInput = z.object({
  id: z.string().uuid(),
  values: z.record(z.any()),
});

export const updateObservation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => UpdateRowInput.parse(d))
  .handler(async ({ data, context }) =>
    withUser(context.userId, async (client) => {
      const cols = Object.keys(data.values);
      if (cols.length === 0) return;
      assertColumnsAllowed("field_capture_observations", cols);
      const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
      await client.query(
        `UPDATE public.field_capture_observations SET ${setClause} WHERE id = $${cols.length + 1}`,
        [...Object.values(data.values), data.id],
      );
    }),
  );

export const removeObservation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }) =>
    withUser(context.userId, (client) =>
      client.query(
        "DELETE FROM public.field_capture_observations WHERE id = $1",
        [data.id],
      ),
    ),
  );

// ---- quick captures ----

const AddQuickCaptureInput = z.object({
  fieldId: z.string().uuid(),
  values: z.record(z.any()),
});

export const addQuickCapture = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => AddQuickCaptureInput.parse(d))
  .handler(async ({ data, context }) =>
    withUser(context.userId, async (client) => {
      const valueCols = Object.keys(data.values);
      assertColumnsAllowed("field_quick_captures", valueCols);
      const cols = ["field_assessment_id", ...valueCols, "created_by"];
      const vals = [
        data.fieldId,
        ...Object.values(data.values),
        context.userId,
      ];
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
      const { rows } = await client.query(
        `INSERT INTO public.field_quick_captures (${cols.join(", ")}) VALUES (${placeholders}) RETURNING id`,
        vals,
      );
      return rows[0].id as string;
    }),
  );

export const removeQuickCapture = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }) =>
    withUser(context.userId, (client) =>
      client.query("DELETE FROM public.field_quick_captures WHERE id = $1", [
        data.id,
      ]),
    ),
  );

const ConvertCaptureInput = z.object({
  fieldId: z.string().uuid(),
  captureId: z.string().uuid(),
  domainCode: z.string(),
  area: z.string().nullable().optional(),
  machine: z.string().nullable().optional(),
  observedCondition: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

export const convertQuickCapture = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ConvertCaptureInput.parse(d))
  .handler(async ({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO public.field_capture_observations
           (field_assessment_id, domain_code, area, machine, observed_condition, assessor_notes, evidence_class, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'Requires Validation', $7) RETURNING id`,
        [
          data.fieldId,
          data.domainCode,
          data.area ?? null,
          data.machine ?? null,
          data.observedCondition ?? null,
          data.note ?? null,
          context.userId,
        ],
      );
      const observationId = rows[0].id as string;
      await client.query(
        "UPDATE public.field_quick_captures SET converted_observation_id = $1 WHERE id = $2",
        [observationId, data.captureId],
      );
      return observationId;
    }),
  );

// ---- gaps ----

const AddGapInput = z.object({
  fieldId: z.string().uuid(),
  values: z.record(z.any()),
});

export const addGap = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => AddGapInput.parse(d))
  .handler(async ({ data, context }) =>
    withUser(context.userId, async (client) => {
      const valueCols = Object.keys(data.values);
      assertColumnsAllowed("field_gaps", valueCols);
      const cols = ["field_assessment_id", ...valueCols];
      const vals = [data.fieldId, ...Object.values(data.values)];
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
      const { rows } = await client.query(
        `INSERT INTO public.field_gaps (${cols.join(", ")}) VALUES (${placeholders}) RETURNING id`,
        vals,
      );
      return rows[0].id as string;
    }),
  );

export const updateGap = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => UpdateRowInput.parse(d))
  .handler(async ({ data, context }) =>
    withUser(context.userId, async (client) => {
      const cols = Object.keys(data.values);
      if (cols.length === 0) return;
      assertColumnsAllowed("field_gaps", cols);
      const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
      await client.query(
        `UPDATE public.field_gaps SET ${setClause} WHERE id = $${cols.length + 1}`,
        [...Object.values(data.values), data.id],
      );
    }),
  );

export const removeGap = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }) =>
    withUser(context.userId, (client) =>
      client.query("DELETE FROM public.field_gaps WHERE id = $1", [data.id]),
    ),
  );

const GapFromObservationInput = z.object({
  fieldId: z.string().uuid(),
  gapNumber: z.number(),
  observation: z.record(z.any()),
});

export const gapFromObservation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => GapFromObservationInput.parse(d))
  .handler(async ({ data, context }) => {
    const o = data.observation as Record<string, unknown>;
    const location = [o.area, o.machine, o.production_cell]
      .filter(Boolean)
      .join(" / ");
    const title =
      (typeof o.observed_condition === "string"
        ? o.observed_condition.trim().slice(0, 160)
        : "") ||
      (o.category as string | undefined) ||
      "Capability gap";
    return withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO public.field_gaps
           (field_assessment_id, gap_number, sort_order, title, domain_code, category, focus_area, severity,
            observation_id, location, observed_condition, objective_evidence, evidence_class,
            operational_impact_text, missing_capability, ironclad_support, validation_needed, field_rating, current_state)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         RETURNING id`,
        [
          data.fieldId,
          data.gapNumber,
          data.gapNumber,
          title,
          o.domain_code ?? null,
          o.category ?? null,
          o.focus_area ?? null,
          o.severity ?? null,
          o.id ?? null,
          location || null,
          o.observed_condition ?? null,
          o.objective_evidence ?? null,
          o.evidence_class ?? null,
          o.operational_impact ?? null,
          o.constrained_capability ?? null,
          o.ironclad_support ?? null,
          o.requires_validation
            ? "Requires validation before it can be treated as confirmed."
            : null,
          o.rating ?? null,
          o.observed_condition ?? null,
        ],
      );
      return rows[0].id as string;
    });
  });

// ---- evidence files ----

const UploadEvidenceInput = z.object({
  fieldId: z.string().uuid(),
  fileName: z.string(),
  fileBase64: z.string(),
  contentType: z.string().optional(),
  observationId: z.string().uuid().nullable().optional(),
  gapId: z.string().uuid().nullable().optional(),
  caption: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  machine: z.string().nullable().optional(),
  domainCode: z.string().nullable().optional(),
});

export const uploadEvidence = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => UploadEvidenceInput.parse(d))
  .handler(async ({ data, context }) => {
    const safe = data.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);
    const path = `${data.fieldId}/${crypto.randomUUID()}-${safe}`;
    const buffer = Buffer.from(data.fileBase64, "base64");
    await uploadObject(EVIDENCE_BUCKET, path, buffer, data.contentType);

    await withUser(context.userId, (client) =>
      client.query(
        `INSERT INTO public.field_attachments
           (field_assessment_id, observation_id, gap_id, storage_path, file_name, caption, area, machine, domain_code, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          data.fieldId,
          data.observationId ?? null,
          data.gapId ?? null,
          path,
          data.fileName.slice(0, 200),
          data.caption?.slice(0, 300) ?? null,
          data.area ?? null,
          data.machine ?? null,
          data.domainCode ?? null,
          context.userId,
        ],
      ),
    );
    return path;
  });

const EvidenceUrlInput = z.object({ path: z.string() });

export const getEvidenceUrl = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => EvidenceUrlInput.parse(d))
  .handler(async ({ data, context }) => {
    // Previously minted a signed download URL for ANY client-supplied
    // storage path with no ownership check at all -- RLS protects
    // Postgres rows, not S3 object keys, so this endpoint's only
    // "authorization" was whether the caller happened to know the path
    // string. field_attachments' own RLS policy already prevents a user
    // from ever *seeing* another org's storage_path through legitimate
    // app usage (verified), so this wasn't exploitable via normal app
    // reads -- but it's still real defense-in-depth to close: anyone who
    // learned a path out-of-band (a leaked screenshot, a log line, a
    // browser history entry, a former staff session) could mint a fresh
    // signed URL for it indefinitely, from any account, with no
    // ownership check at all. Mirrors the same
    // resolve-then-check pattern used for CAD/CNC's product-restriction
    // fix: look the path up in field_attachments under the caller's own
    // RLS-scoped role first -- if RLS wouldn't let them see this row,
    // the query returns nothing and access is correctly denied.
    const owned = await withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        "SELECT 1 FROM public.field_attachments WHERE storage_path = $1",
        [data.path],
      );
      return rows.length > 0;
    });
    if (!owned) {
      throw new Error("Evidence file not found or not accessible.");
    }
    return getSignedDownloadUrl(EVIDENCE_BUCKET, data.path, 60 * 60);
  });

const DeleteEvidenceInput = z.object({ id: z.string().uuid() });

export const deleteEvidence = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => DeleteEvidenceInput.parse(d))
  .handler(async ({ data, context }) => {
    // Previously took `storagePath` as its own client-supplied field and
    // deleted it from S3 with NO check at all -- the same
    // arbitrary-file-deletion pattern fixed for deleteCadJob and
    // deleteIntakeDocument (see that commit for the full writeup). Any
    // authenticated user could delete any object in the evidence bucket,
    // from any organization's field assessment, by supplying a path
    // string with no ownership tie to `id` whatsoever. Fixed the same
    // way: resolve the real storage_path server-side, under the
    // caller's own RLS-scoped role, before deleting anything.
    const storagePath = await withUser(context.userId, async (client) => {
      const { rows } = await client.query<{ storage_path: string }>(
        "SELECT storage_path FROM public.field_attachments WHERE id = $1",
        [data.id],
      );
      return rows[0]?.storage_path ?? null;
    });
    if (!storagePath)
      throw new Error("Evidence file not found or not accessible.");
    await deleteObject(EVIDENCE_BUCKET, storagePath);
    await withUser(context.userId, (client) =>
      client.query("DELETE FROM public.field_attachments WHERE id = $1", [
        data.id,
      ]),
    );
  });

// ---- convert to full capability assessment ----

const ConvertToFullInput = z.object({
  fieldId: z.string().uuid(),
  assessment: z.record(z.any()),
  gaps: z.array(z.record(z.any())),
});

export const convertToFullAssessment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ConvertToFullInput.parse(d))
  .handler(async ({ data, context }) => {
    const assessment = data.assessment as Record<string, unknown>;
    const userId = context.userId;
    const name = `${assessment.client_name ?? "Capability"} — Full Capability Assessment`;

    return withUser(userId, async (client) => {
      const { rows: capRows } = await client.query(
        `INSERT INTO public.cap_assessments
           (organization_id, facility_id, name, lead_assessor, scope, status, created_by, modified_by)
         VALUES ($1,$2,$3,$4,$5,'intake',$6,$6) RETURNING id`,
        [
          assessment.organization_id,
          assessment.facility_id,
          name,
          assessment.assessors,
          `Carried forward from the Field Capability Assessment for ${assessment.area ?? "the facility"}.`,
          userId,
        ],
      );
      const capId = capRows[0].id as string;

      const whereWhen = [
        assessment.problem_department,
        assessment.problem_area,
        assessment.problem_cell,
        assessment.problem_machine,
        assessment.problem_process,
        assessment.problem_timing,
      ]
        .filter(Boolean)
        .join(" · ");

      await client.query(
        `INSERT INTO public.cap_problems
           (assessment_id, created_by, q_greatest_impact, q_where_when, q_effect, q_tried, q_if_resolved)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          capId,
          userId,
          assessment.problem_statement ?? null,
          whereWhen || null,
          Array.isArray(assessment.impact_tags)
            ? assessment.impact_tags.join(", ") || null
            : null,
          assessment.attempted ?? null,
          assessment.improvement_if_resolved ?? null,
        ],
      );

      const { rows: observations } = await client.query(
        "SELECT * FROM public.field_capture_observations WHERE field_assessment_id = $1 ORDER BY created_at",
        [data.fieldId],
      );
      const { rows: attachments } = await client.query(
        "SELECT * FROM public.field_attachments WHERE field_assessment_id = $1",
        [data.fieldId],
      );

      const evidenceClassToCap: Record<string, string> = {
        Observed: "direct_observation",
        Reported: "customer_interview",
        Inferred: "other",
        "Requires Validation": "other",
      };

      for (const o of observations) {
        if (!(o.observed_condition ?? "").trim()) continue;
        const attachment = attachments.find((a) => a.observation_id === o.id);
        await client.query(
          `INSERT INTO public.cap_observations
             (assessment_id, organization_id, area_process, machine_cell, observation, performance_effect, severity,
              evidence_type, evidence_note, file_path, assessor_notes, created_by, modified_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)`,
          [
            capId,
            assessment.organization_id,
            [o.focus_area, o.area, o.process].filter(Boolean).join(" / ") ||
              null,
            [o.machine, o.production_cell].filter(Boolean).join(" / ") || null,
            o.observed_condition,
            o.operational_impact ?? null,
            o.severity ?? null,
            evidenceClassToCap[o.evidence_class] ?? "direct_observation",
            o.objective_evidence ?? null,
            attachment?.storage_path ?? null,
            [
              "Carried forward from the Field Capability Assessment.",
              o.assessor_notes,
              o.constrained_capability
                ? `Constrained capability: ${o.constrained_capability}`
                : null,
            ]
              .filter(Boolean)
              .join(" "),
            userId,
          ],
        );
      }

      for (const g of data.gaps as Record<string, unknown>[]) {
        if (!g.title && !g.observed_condition) continue;
        await client.query(
          `INSERT INTO public.cap_findings
             (assessment_id, title, finding_text, classification, source, confidence, assessor_notes, created_by)
           VALUES ($1,$2,$3,$4,'ironclad_validated',$5,$6,$7)`,
          [
            capId,
            String(g.title ?? g.observed_condition ?? "Field finding").slice(
              0,
              200,
            ),
            [g.observed_condition, g.objective_evidence]
              .filter(Boolean)
              .join("\n\nEvidence: "),
            g.is_top_finding ? "primary_constraint" : "contributing_constraint",
            g.confidence === "High Confidence" ? "high" : "low",
            "Carried forward from the Field Capability Assessment. Requires validation.",
            userId,
          ],
        );
      }

      await client.query(
        "UPDATE public.field_assessments SET assessment_status = 'Converted to Full Assessment' WHERE id = $1",
        [data.fieldId],
      );

      return capId;
    });
  });
