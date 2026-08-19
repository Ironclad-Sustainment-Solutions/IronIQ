import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";
import { assertColumnsAllowed } from "@/lib/column-allowlist";
import { assertProductAllowed, assertProductAllowedForCapAssessment } from "@/lib/product-access-check.server";

// Every table name reachable through the generic upsert/delete helpers below.
// This allowlist is the only thing standing between client-supplied table
// names and raw SQL — never remove it or interpolate a table name that isn't
// on this list.
const ALLOWED_TABLES = new Set([
  "cap_actions",
  "cap_evidence",
  "cap_finding_links",
  "cap_findings",
  "cap_performance_impacts",
  "cap_problems",
  "cap_results",
  "cap_root_gaps",
  "cap_validations",
  "cap_assessments",
  "cap_scores",
]);

function assertAllowed(table: string) {
  if (!ALLOWED_TABLES.has(table))
    throw new Error(`Table "${table}" is not allowed here.`);
}

// Resolves organization_id for any row already in ALLOWED_TABLES, given
// that table varies from "has organization_id directly" (cap_assessments)
// to "one join away" (assessment_id) to "two joins away" (finding_id or
// action_id, which themselves reference an assessment). Used to product-
// restriction-gate capUpsert's update path and capDelete, which operate
// on an existing row identified only by id and table name.
const CAP_TABLE_ORG_QUERIES: Record<string, string> = {
  cap_assessments: `SELECT organization_id FROM public.cap_assessments WHERE id = $1`,
  cap_actions: `SELECT a.organization_id FROM public.cap_assessments a JOIN public.cap_actions x ON x.assessment_id = a.id WHERE x.id = $1`,
  cap_findings: `SELECT a.organization_id FROM public.cap_assessments a JOIN public.cap_findings x ON x.assessment_id = a.id WHERE x.id = $1`,
  cap_performance_impacts: `SELECT a.organization_id FROM public.cap_assessments a JOIN public.cap_performance_impacts x ON x.assessment_id = a.id WHERE x.id = $1`,
  cap_problems: `SELECT a.organization_id FROM public.cap_assessments a JOIN public.cap_problems x ON x.assessment_id = a.id WHERE x.id = $1`,
  cap_root_gaps: `SELECT a.organization_id FROM public.cap_assessments a JOIN public.cap_root_gaps x ON x.assessment_id = a.id WHERE x.id = $1`,
  cap_scores: `SELECT a.organization_id FROM public.cap_assessments a JOIN public.cap_scores x ON x.assessment_id = a.id WHERE x.id = $1`,
  cap_evidence: `SELECT a.organization_id FROM public.cap_assessments a JOIN public.cap_findings f ON f.assessment_id = a.id JOIN public.cap_evidence x ON x.finding_id = f.id WHERE x.id = $1`,
  cap_finding_links: `SELECT a.organization_id FROM public.cap_assessments a JOIN public.cap_findings f ON f.assessment_id = a.id JOIN public.cap_finding_links x ON x.parent_finding_id = f.id WHERE x.id = $1`,
  cap_results: `SELECT a.organization_id FROM public.cap_assessments a JOIN public.cap_actions ac ON ac.assessment_id = a.id JOIN public.cap_results x ON x.action_id = ac.id WHERE x.id = $1`,
  cap_validations: `SELECT a.organization_id FROM public.cap_assessments a JOIN public.cap_actions ac ON ac.assessment_id = a.id JOIN public.cap_validations x ON x.action_id = ac.id WHERE x.id = $1`,
};

async function assertProductAllowedForCapRow(
  userId: string,
  table: string,
  id: string,
): Promise<void> {
  const query = CAP_TABLE_ORG_QUERIES[table];
  if (!query) throw new Error(`No product-restriction lookup configured for table "${table}".`);
  const organizationId = await withUser(userId, async (client) => {
    const { rows } = await client.query<{ organization_id: string }>(query, [id]);
    return rows[0]?.organization_id ?? null;
  });
  if (!organizationId) throw new Error("Record not found or not accessible.");
  await assertProductAllowed(userId, organizationId, "assessment");
}

// Closes the gap the capUpsert create-path comment used to document as
// deliberately left out: cap_evidence/cap_finding_links reference a
// finding, cap_results/cap_validations reference an action, neither of
// which is assessment_id directly. Both resolve to organization_id one
// join further out than assertProductAllowedForCapAssessment handles.
async function resolveCapFindingOrg(userId: string, findingId: string): Promise<string | null> {
  return withUser(userId, async (client) => {
    const { rows } = await client.query<{ organization_id: string }>(
      `SELECT a.organization_id FROM public.cap_assessments a JOIN public.cap_findings f ON f.assessment_id = a.id WHERE f.id = $1`,
      [findingId],
    );
    return rows[0]?.organization_id ?? null;
  });
}

async function resolveCapActionOrg(userId: string, actionId: string): Promise<string | null> {
  return withUser(userId, async (client) => {
    const { rows } = await client.query<{ organization_id: string }>(
      `SELECT a.organization_id FROM public.cap_assessments a JOIN public.cap_actions ac ON ac.assessment_id = a.id WHERE ac.id = $1`,
      [actionId],
    );
    return rows[0]?.organization_id ?? null;
  });
}

export const fetchCapabilityLibrary = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(({ context }) =>
    withUser(context.userId, async (client) => {
      const [domains, criteria] = await Promise.all([
        client.query("SELECT * FROM public.cap_domains ORDER BY sort_order"),
        client.query("SELECT * FROM public.cap_criteria ORDER BY sort_order"),
      ]);
      return { domains: domains.rows, criteria: criteria.rows };
    }),
  );

const optionalId = z.object({ id: z.string().uuid().optional() });

export const fetchCapAssessments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => optionalId.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = data.id
        ? await client.query(
            "SELECT * FROM public.cap_assessments WHERE organization_id = $1 ORDER BY assessment_date DESC",
            [data.id],
          )
        : await client.query(
            "SELECT * FROM public.cap_assessments ORDER BY assessment_date DESC",
          );
      return rows;
    }),
  );

const idInput = z.object({ id: z.string().uuid() });

export const fetchCapAssessment = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        "SELECT * FROM public.cap_assessments WHERE id = $1",
        [data.id],
      );
      return rows[0] ?? null;
    }),
  );

export const fetchCapWorkspace = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, async (client) => {
      const assessmentId = data.id;
      const [problem, impacts, scores, findings, links, gaps, actions] =
        await Promise.all([
          client.query(
            "SELECT * FROM public.cap_problems WHERE assessment_id = $1",
            [assessmentId],
          ),
          client.query(
            "SELECT * FROM public.cap_performance_impacts WHERE assessment_id = $1",
            [assessmentId],
          ),
          client.query(
            "SELECT * FROM public.cap_scores WHERE assessment_id = $1",
            [assessmentId],
          ),
          client.query(
            "SELECT * FROM public.cap_findings WHERE assessment_id = $1 ORDER BY created_at",
            [assessmentId],
          ),
          client.query("SELECT * FROM public.cap_finding_links"),
          client.query(
            "SELECT * FROM public.cap_root_gaps WHERE assessment_id = $1",
            [assessmentId],
          ),
          client.query(
            "SELECT * FROM public.cap_actions WHERE assessment_id = $1",
            [assessmentId],
          ),
        ]);

      const findingIds = findings.rows.map((f) => f.id as string);
      const actionIds = actions.rows.map((a) => a.id as string);
      const [evidence, results, validations] = await Promise.all([
        findingIds.length
          ? client.query(
              "SELECT * FROM public.cap_evidence WHERE finding_id = ANY($1)",
              [findingIds],
            )
          : Promise.resolve({ rows: [] }),
        actionIds.length
          ? client.query(
              "SELECT * FROM public.cap_results WHERE action_id = ANY($1)",
              [actionIds],
            )
          : Promise.resolve({ rows: [] }),
        actionIds.length
          ? client.query(
              "SELECT * FROM public.cap_validations WHERE action_id = ANY($1)",
              [actionIds],
            )
          : Promise.resolve({ rows: [] }),
      ]);

      const findingSet = new Set(findingIds);
      return {
        problem: problem.rows[0] ?? null,
        impacts: impacts.rows,
        scores: scores.rows,
        findings: findings.rows,
        links: links.rows.filter((l) => findingSet.has(l.parent_finding_id)),
        gaps: gaps.rows,
        actions: actions.rows,
        evidence: evidence.rows,
        results: results.rows,
        validations: validations.rows,
      };
    }),
  );

const CapUpsertInput = z.object({
  table: z.string(),
  id: z.string().uuid().optional(),
  values: z.record(z.any()),
});

export const capUpsert = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => CapUpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    assertAllowed(data.table);
    if (data.id) {
      await assertProductAllowedForCapRow(context.userId, data.table, data.id);
    } else {
      // Creating a new child row -- resolve the org via whichever parent
      // id the client is linking it to. assessment_id covers six tables
      // directly; finding_id/parent_finding_id (cap_evidence,
      // cap_finding_links) and action_id (cap_results, cap_validations)
      // each need one more join out to reach organization_id, which is
      // what previously made this branch stop short -- now resolved via
      // resolveCapFindingOrg/resolveCapActionOrg.
      const assessmentId = data.values["assessment_id"];
      const findingId = data.values["finding_id"] ?? data.values["parent_finding_id"];
      const actionId = data.values["action_id"];

      let organizationId: string | null = null;
      if (typeof assessmentId === "string") {
        organizationId = await withUser(context.userId, async (client) => {
          const { rows } = await client.query<{ organization_id: string }>(
            `SELECT organization_id FROM public.cap_assessments WHERE id = $1`,
            [assessmentId],
          );
          return rows[0]?.organization_id ?? null;
        });
      } else if (typeof findingId === "string") {
        organizationId = await resolveCapFindingOrg(context.userId, findingId);
      } else if (typeof actionId === "string") {
        organizationId = await resolveCapActionOrg(context.userId, actionId);
      }

      if (organizationId) {
        await assertProductAllowed(context.userId, organizationId, "assessment");
      }
      // If none of assessment_id/finding_id/parent_finding_id/action_id
      // was supplied, there's no parent to resolve an org from -- the
      // INSERT itself will fail on whatever real FK constraint the table
      // has, so no restriction check can run either way.
    }
    return withUser(context.userId, async (client) => {
      const payload = { ...data.values, modified_by: context.userId };
      if (data.id) {
        const cols = Object.keys(payload);
        assertColumnsAllowed(data.table, cols);
        const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
        await client.query(
          `UPDATE public.${data.table} SET ${setClause} WHERE id = $${cols.length + 1}`,
          [...Object.values(payload), data.id],
        );
        return data.id;
      }
      const insertPayload = { ...payload, created_by: context.userId };
      const cols = Object.keys(insertPayload);
      assertColumnsAllowed(data.table, cols);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      const { rows } = await client.query(
        `INSERT INTO public.${data.table} (${cols.join(", ")}) VALUES (${placeholders}) RETURNING id`,
        Object.values(insertPayload),
      );
      return rows[0].id as string;
    });
  });

const CapDeleteInput = z.object({ table: z.string(), id: z.string().uuid() });

export const capDelete = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => CapDeleteInput.parse(d))
  .handler(async ({ data, context }) => {
    assertAllowed(data.table);
    await assertProductAllowedForCapRow(context.userId, data.table, data.id);
    await withUser(context.userId, (client) =>
      client.query(`DELETE FROM public.${data.table} WHERE id = $1`, [data.id]),
    );
  });

const CreateCapAssessmentInput = z.object({
  organization_id: z.string().uuid(),
  facility_id: z.string().uuid().nullable().optional(),
  name: z.string(),
  lead_assessor: z.string().nullable().optional(),
  scope: z.string().nullable().optional(),
});

export const createCapAssessment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => CreateCapAssessmentInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertProductAllowed(context.userId, data.organization_id, "assessment");
    return withUser(context.userId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO public.cap_assessments
           (organization_id, facility_id, name, lead_assessor, scope, status, created_by, modified_by)
         VALUES ($1,$2,$3,$4,$5,'intake',$6,$6) RETURNING id`,
        [
          data.organization_id,
          data.facility_id ?? null,
          data.name,
          data.lead_assessor ?? null,
          data.scope ?? null,
          context.userId,
        ],
      );
      const id = rows[0].id as string;
      await client.query(
        "INSERT INTO public.cap_problems (assessment_id, created_by) VALUES ($1, $2)",
        [id, context.userId],
      );
      return id;
    });
  });

const SaveCapScoreInput = z.object({
  assessmentId: z.string().uuid(),
  criterion_id: z.string().uuid(),
  dimension: z.string(),
  score: z.number().nullable().optional(),
  not_applicable: z.boolean().optional(),
  rationale: z.string().nullable().optional(),
  confidence: z.string().nullable().optional(),
});

export const saveCapScore = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SaveCapScoreInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertProductAllowedForCapAssessment(context.userId, data.assessmentId, "assessment");
    await withUser(context.userId, (client) =>
      client.query(
        `INSERT INTO public.cap_scores
           (assessment_id, criterion_id, dimension, score, not_applicable, rationale, confidence, modified_by, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
         ON CONFLICT (assessment_id, criterion_id, dimension)
         DO UPDATE SET score = $4, not_applicable = $5, rationale = $6, confidence = $7, modified_by = $8`,
        [
          data.assessmentId,
          data.criterion_id,
          data.dimension,
          data.score ?? null,
          data.not_applicable ?? false,
          data.rationale ?? null,
          data.confidence ?? null,
          context.userId,
        ],
      ),
    );
  });

const SetAssessmentScoreInput = z.object({
  assessmentId: z.string().uuid(),
  overall: z.number().nullable(),
  status: z.string().optional(),
});

export const setAssessmentScore = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SetAssessmentScoreInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertProductAllowedForCapAssessment(context.userId, data.assessmentId, "assessment");
    await withUser(context.userId, (client) =>
      data.status
        ? client.query(
            "UPDATE public.cap_assessments SET overall_score = $1, status = $2 WHERE id = $3",
            [data.overall, data.status, data.assessmentId],
          )
        : client.query(
            "UPDATE public.cap_assessments SET overall_score = $1 WHERE id = $2",
            [data.overall, data.assessmentId],
          ),
    );
  });

const ApproveFindingInput = z.object({
  id: z.string().uuid(),
  approved: z.boolean(),
});

export const approveFinding = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ApproveFindingInput.parse(d))
  .handler(async ({ data, context }) => {
    await withUser(context.userId, (client) =>
      client.query(
        `UPDATE public.cap_findings
         SET approved = $1, approved_by = $2, approved_at = $3, modified_by = $4
         WHERE id = $5`,
        [
          data.approved,
          data.approved ? context.userId : null,
          data.approved ? new Date().toISOString() : null,
          context.userId,
          data.id,
        ],
      ),
    );
  });
