import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import {
  assertProductAllowed,
  assertProductAllowedForAssessment,
} from "@/lib/product-access-check.server";

const optionalId = z.object({ id: z.string().uuid().optional() });

export const fetchOrganizations = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(({ context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        "SELECT * FROM public.organizations ORDER BY name",
      );
      return rows;
    }),
  );

export const fetchFacilities = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => optionalId.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = data.id
        ? await client.query(
            "SELECT * FROM public.facilities WHERE organization_id = $1 ORDER BY name",
            [data.id],
          )
        : await client.query("SELECT * FROM public.facilities ORDER BY name");
      return rows;
    }),
  );

export const fetchAssessments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => optionalId.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = data.id
        ? await client.query(
            "SELECT * FROM public.assessments WHERE facility_id = $1 ORDER BY assessment_date DESC",
            [data.id],
          )
        : await client.query(
            "SELECT * FROM public.assessments ORDER BY assessment_date DESC",
          );
      return rows;
    }),
  );

const assessmentIdInput = z.object({ assessmentId: z.string().uuid() });

export const fetchAssessment = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => assessmentIdInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        "SELECT * FROM public.assessments WHERE id = $1",
        [data.assessmentId],
      );
      return rows[0] ?? null;
    }),
  );

const templateVersionInput = z.object({ templateVersionId: z.string().uuid() });

export const fetchTemplateContent = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => templateVersionInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows: categories } = await client.query(
        "SELECT * FROM public.assessment_categories WHERE template_version_id = $1 ORDER BY sort_order",
        [data.templateVersionId],
      );
      const categoryIds = categories.map((c) => c.id);
      const { rows: questions } =
        categoryIds.length > 0
          ? await client.query(
              "SELECT * FROM public.assessment_questions WHERE category_id = ANY($1) ORDER BY sort_order",
              [categoryIds],
            )
          : { rows: [] };
      return { categories, questions };
    }),
  );

export const fetchResponses = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => assessmentIdInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        "SELECT * FROM public.assessment_responses WHERE assessment_id = $1",
        [data.assessmentId],
      );
      return rows;
    }),
  );

export const fetchFindings = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => optionalId.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = data.id
        ? await client.query(
            "SELECT * FROM public.findings WHERE facility_id = $1 ORDER BY created_at",
            [data.id],
          )
        : await client.query(
            "SELECT * FROM public.findings ORDER BY created_at",
          );
      return rows;
    }),
  );

/**
 * Replaces what used to be three hardcoded, fake notification items in
 * app-shell.tsx's bell dropdown ("2 critical findings remain open",
 * specific made-up dates and plant names) with real queries. Scoped to
 * facility when one is selected, matching every other facility-scoped
 * query in this file.
 */
export const fetchNotifications = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => optionalId.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const facilityFilter = data.id ? "AND facility_id = $1" : "";
      const params = data.id ? [data.id] : [];

      const criticalFindings = await client.query(
        `SELECT count(*)::int AS count FROM public.findings
          WHERE severity = 'critical' AND status NOT IN ('closed', 'accepted_risk') AND archived = false ${facilityFilter}`,
        params,
      );

      const upcomingActions = await client.query(
        `SELECT id, action_description, target_date FROM public.corrective_actions
          WHERE status NOT IN ('closed', 'accepted_risk') AND target_date IS NOT NULL AND target_date >= CURRENT_DATE ${facilityFilter}
          ORDER BY target_date ASC LIMIT 3`,
        params,
      );

      const inProgressAssessments = await client.query(
        `SELECT id, name FROM public.assessments
          WHERE status = 'in_progress' ${facilityFilter}
          ORDER BY assessment_date DESC LIMIT 3`,
        params,
      );

      return {
        criticalFindingsCount: criticalFindings.rows[0]?.count ?? 0,
        upcomingActions: upcomingActions.rows,
        inProgressAssessments: inProgressAssessments.rows,
      };
    }),
  );

export const fetchCorrectiveActions = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => optionalId.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = data.id
        ? await client.query(
            "SELECT * FROM public.corrective_actions WHERE facility_id = $1 ORDER BY target_date",
            [data.id],
          )
        : await client.query(
            "SELECT * FROM public.corrective_actions ORDER BY target_date",
          );
      return rows;
    }),
  );

export const fetchProjects = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => optionalId.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = data.id
        ? await client.query(
            "SELECT * FROM public.improvement_projects WHERE facility_id = $1 ORDER BY planned_start",
            [data.id],
          )
        : await client.query(
            "SELECT * FROM public.improvement_projects ORDER BY planned_start",
          );
      return rows;
    }),
  );

export const fetchReadinessHistory = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z.object({ facilityId: z.string().uuid() }).parse(d),
  )
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        "SELECT * FROM public.readiness_history WHERE facility_id = $1 ORDER BY recorded_on",
        [data.facilityId],
      );
      return rows;
    }),
  );

export const fetchTemplates = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(({ context }) =>
    withUser(context.userId, async (client) => {
      const { rows: templates } = await client.query(
        "SELECT * FROM public.assessment_templates ORDER BY name",
      );
      const { rows: versions } = await client.query(
        "SELECT * FROM public.assessment_template_versions ORDER BY version",
      );
      return { templates, versions };
    }),
  );

export const fetchTemplateLibrary = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(({ context }) =>
    withUser(context.userId, async (client) => {
      const [templates, versions, categories, questions] = await Promise.all([
        client.query("SELECT * FROM public.assessment_templates ORDER BY name"),
        client.query(
          "SELECT * FROM public.assessment_template_versions ORDER BY version",
        ),
        client.query(
          "SELECT * FROM public.assessment_categories ORDER BY sort_order",
        ),
        client.query(
          "SELECT * FROM public.assessment_questions ORDER BY sort_order",
        ),
      ]);
      return {
        templates: templates.rows,
        versions: versions.rows,
        categories: categories.rows,
        questions: questions.rows,
      };
    }),
  );

export const fetchAuthorProfiles = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(({ context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        "SELECT id, full_name, email FROM public.profiles",
      );
      return rows;
    }),
  );

export const fetchAuditLog = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(({ context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        "SELECT * FROM public.audit_logs ORDER BY created_at DESC LIMIT 100",
      );
      return rows;
    }),
  );

const UpsertResponseInput = z.object({
  assessment_id: z.string().uuid(),
  question_id: z.string().uuid(),
  score: z.number().nullable(),
  not_applicable: z.boolean(),
  comments: z.string().nullable(),
  evidence_type: z.string(),
  answered_at: z.string().nullable(),
  answered_by: z.string().uuid().nullable(),
});

export const upsertAssessmentResponse = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => UpsertResponseInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertProductAllowedForAssessment(
      context.userId,
      data.assessment_id,
      "assessment",
    );
    await withUser(context.userId, (client) =>
      client.query(
        `INSERT INTO public.assessment_responses
           (assessment_id, question_id, score, not_applicable, comments, evidence_type, answered_at, answered_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (assessment_id, question_id)
         DO UPDATE SET
           score = $3, not_applicable = $4, comments = $5, evidence_type = $6, answered_at = $7, answered_by = $8`,
        [
          data.assessment_id,
          data.question_id,
          data.score,
          data.not_applicable,
          data.comments,
          data.evidence_type,
          data.answered_at,
          data.answered_by,
        ],
      ),
    );
  });

const CreateAssessmentInput = z.object({
  organization_id: z.string().uuid(),
  facility_id: z.string().uuid(),
  template_version_id: z.string().uuid(),
  name: z.string(),
  assessment_type: z.string().nullable().optional(),
  assessment_date: z.string(),
  lead_assessor: z.string().nullable().optional(),
  production_area: z.string().nullable().optional(),
  product_family: z.string().nullable().optional(),
  scope: z.string().nullable().optional(),
});

export const createAssessment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => CreateAssessmentInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertProductAllowed(
      context.userId,
      data.organization_id,
      "assessment",
    );
    return withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO public.assessments
           (organization_id, facility_id, template_version_id, name, assessment_type, assessment_date,
            lead_assessor, production_area, product_family, scope, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'in_progress') RETURNING id`,
        [
          data.organization_id,
          data.facility_id,
          data.template_version_id,
          data.name,
          data.assessment_type ?? null,
          data.assessment_date,
          data.lead_assessor ?? null,
          data.production_area ?? null,
          data.product_family ?? null,
          data.scope ?? null,
        ],
      );
      return rows[0] as { id: string };
    });
  });

const logAuditInput = z.object({
  organization_id: z.string().uuid().nullable().optional(),
  facility_id: z.string().uuid().nullable().optional(),
  actor_name: z.string().nullable().optional(),
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.string().uuid().nullable().optional(),
  details: z.record(z.any()).optional(),
});

export const logAudit = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => logAuditInput.parse(d))
  .handler(async ({ data, context }) => {
    await withUser(context.userId, (client) =>
      client.query(
        `INSERT INTO public.audit_logs
           (organization_id, facility_id, actor_id, actor_name, action, entity_type, entity_id, details)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          data.organization_id ?? null,
          data.facility_id ?? null,
          context.userId,
          data.actor_name ?? null,
          data.action,
          data.entity_type,
          data.entity_id ?? null,
          JSON.stringify(data.details ?? {}),
        ],
      ),
    );
  });
