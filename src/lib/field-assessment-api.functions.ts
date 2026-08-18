import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import { assertColumnsAllowed } from "@/lib/column-allowlist";

const ChildTable = z.enum([
  "field_gaps",
  "field_constraints",
  "field_opportunities",
]);

const FieldAssessmentsInput = z.object({
  organizationId: z.string().uuid(),
  facilityId: z.string().uuid().nullable().optional(),
});

export const fetchFieldAssessments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => FieldAssessmentsInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = data.facilityId
        ? await client.query(
            "SELECT * FROM public.field_assessments WHERE organization_id = $1 AND facility_id = $2 ORDER BY observed_at DESC",
            [data.organizationId, data.facilityId],
          )
        : await client.query(
            "SELECT * FROM public.field_assessments WHERE organization_id = $1 ORDER BY observed_at DESC",
            [data.organizationId],
          );
      return rows;
    }),
  );

const idInput = z.object({ id: z.string().uuid() });

export const fetchFieldAssessment = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const [assessment, ratings] = await Promise.all([
        client.query("SELECT * FROM public.field_assessments WHERE id = $1", [
          data.id,
        ]),
        client.query(
          "SELECT * FROM public.field_assessment_ratings WHERE field_assessment_id = $1",
          [data.id],
        ),
      ]);
      return { assessment: assessment.rows[0] ?? null, ratings: ratings.rows };
    }),
  );

const CreateFieldAssessmentInput = z.object({
  organization_id: z.string().uuid(),
  facility_id: z.string().uuid().nullable().optional(),
  area: z.string(),
  work_center: z.string().nullable().optional(),
  shift: z.string().nullable().optional(),
  observer_name: z.string().nullable().optional(),
});

export const createFieldAssessment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => CreateFieldAssessmentInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO public.field_assessments
           (organization_id, facility_id, area, work_center, shift, observer_name, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [
          data.organization_id,
          data.facility_id ?? null,
          data.area.trim().slice(0, 120),
          data.work_center?.trim().slice(0, 120) || null,
          data.shift ?? null,
          data.observer_name?.trim().slice(0, 120) || null,
          context.userId,
        ],
      );
      return rows[0].id as string;
    }),
  );

const SaveFieldRatingInput = z.object({
  fieldAssessmentId: z.string().uuid(),
  domain_id: z.string(),
  score: z.number().nullable().optional(),
  not_applicable: z.boolean().optional(),
  note: z.string().nullable().optional(),
  needs_action: z.boolean().optional(),
});

export const saveFieldRating = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SaveFieldRatingInput.parse(d))
  .handler(async ({ data, context }) => {
    await withUser(context.userId, (client) =>
      client.query(
        `INSERT INTO public.field_assessment_ratings
           (field_assessment_id, domain_id, score, not_applicable, note, needs_action)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (field_assessment_id, domain_id)
         DO UPDATE SET score = $3, not_applicable = $4, note = $5, needs_action = $6`,
        [
          data.fieldAssessmentId,
          data.domain_id,
          data.score ?? null,
          data.not_applicable ?? false,
          data.note?.slice(0, 1000) ?? null,
          data.needs_action ?? false,
        ],
      ),
    );
  });

const UpdateFieldAssessmentInput = z.object({
  id: z.string().uuid(),
  values: z.record(z.any()),
});

export const updateFieldAssessment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => UpdateFieldAssessmentInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const cols = Object.keys(data.values);
      if (cols.length === 0) return;
      assertColumnsAllowed("field_assessments", cols);
      const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
      await client.query(
        `UPDATE public.field_assessments SET ${setClause} WHERE id = $${cols.length + 1}`,
        [...Object.values(data.values), data.id],
      );
    }),
  );

export const deleteFieldAssessment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    await withUser(context.userId, (client) =>
      client.query("DELETE FROM public.field_assessments WHERE id = $1", [
        data.id,
      ]),
    );
  });

const fieldIdInput = z.object({ fieldId: z.string().uuid() });

export const fetchFieldReview = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => fieldIdInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const id = data.fieldId;
      const [observations, gaps, constraints, opportunities] =
        await Promise.all([
          client.query(
            "SELECT * FROM public.field_observations WHERE field_assessment_id = $1",
            [id],
          ),
          client.query(
            "SELECT * FROM public.field_gaps WHERE field_assessment_id = $1 ORDER BY sort_order",
            [id],
          ),
          client.query(
            "SELECT * FROM public.field_constraints WHERE field_assessment_id = $1 ORDER BY rank",
            [id],
          ),
          client.query(
            "SELECT * FROM public.field_opportunities WHERE field_assessment_id = $1 ORDER BY sort_order",
            [id],
          ),
        ]);
      return {
        observations: observations.rows,
        gaps: gaps.rows,
        constraints: constraints.rows,
        opportunities: opportunities.rows,
      };
    }),
  );

const SaveObservationInput = z.object({
  fieldId: z.string().uuid(),
  section_code: z.string(),
  area_code: z.string(),
  rating: z.number().nullable().optional(),
  not_observed: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export const saveObservation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SaveObservationInput.parse(d))
  .handler(async ({ data, context }) => {
    await withUser(context.userId, (client) =>
      client.query(
        `INSERT INTO public.field_observations
           (field_assessment_id, section_code, area_code, rating, not_observed, notes)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (field_assessment_id, area_code)
         DO UPDATE SET section_code = $2, rating = $4, not_observed = $5, notes = $6`,
        [
          data.fieldId,
          data.section_code,
          data.area_code,
          data.rating ?? null,
          data.not_observed ?? false,
          data.notes?.slice(0, 2000) ?? null,
        ],
      ),
    );
  });

const ChildAddInput = z.object({
  fieldId: z.string().uuid(),
  table: ChildTable,
  values: z.record(z.any()),
});

export const childAdd = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ChildAddInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const valueCols = Object.keys(data.values);
      assertColumnsAllowed(data.table, valueCols);
      const cols = ["field_assessment_id", ...valueCols];
      const vals = [data.fieldId, ...Object.values(data.values)];
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
      const { rows } = await client.query(
        `INSERT INTO public.${data.table} (${cols.join(", ")}) VALUES (${placeholders}) RETURNING id`,
        vals,
      );
      return rows[0].id as string;
    }),
  );

const ChildUpdateInput = z.object({
  table: ChildTable,
  id: z.string().uuid(),
  values: z.record(z.any()),
});

export const childUpdate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ChildUpdateInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const cols = Object.keys(data.values);
      if (cols.length === 0) return;
      assertColumnsAllowed(data.table, cols);
      const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
      await client.query(
        `UPDATE public.${data.table} SET ${setClause} WHERE id = $${cols.length + 1}`,
        [...Object.values(data.values), data.id],
      );
    }),
  );

const ChildRemoveInput = z.object({ table: ChildTable, id: z.string().uuid() });

export const childRemove = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ChildRemoveInput.parse(d))
  .handler(async ({ data, context }) => {
    await withUser(context.userId, (client) =>
      client.query(`DELETE FROM public.${data.table} WHERE id = $1`, [data.id]),
    );
  });
