import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/auth-middleware";
import { withUser } from "@/lib/db.server";

const PersistAggregatesInput = z.object({
  assessmentId: z.string().uuid(),
  overallScore: z.number().nullable(),
  confidenceScore: z.number().nullable(),
  completionPct: z.number().nullable(),
  readinessLevel: z.string().nullable(),
  hasCriticalFailure: z.boolean(),
  extra: z.record(z.any()).optional(),
});

export const persistAssessmentAggregates = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => PersistAggregatesInput.parse(d))
  .handler(({ data, context }) =>
    withUser(context.userId, (client) => {
      const values = {
        overall_score: data.overallScore,
        confidence_score: data.confidenceScore,
        completion_pct: data.completionPct,
        readiness_level: data.readinessLevel,
        has_critical_failure: data.hasCriticalFailure,
        ...(data.extra ?? {}),
      };
      const cols = Object.keys(values);
      const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
      return client.query(
        `UPDATE public.assessments SET ${setClause} WHERE id = $${cols.length + 1}`,
        [...Object.values(values), data.assessmentId],
      );
    }),
  );

const SyncCriticalFindingsInput = z.object({
  assessment: z.record(z.any()),
  failing: z.array(
    z.object({
      questionId: z.string().uuid(),
      categoryId: z.string().uuid(),
      categoryName: z.string().nullable(),
      questionText: z.string(),
      guidanceText: z.string().nullable(),
      comments: z.string().nullable(),
    }),
  ),
  actorId: z.string().uuid().nullable().optional(),
});

export const syncCriticalFindings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SyncCriticalFindingsInput.parse(d))
  .handler(async ({ data, context }) => {
    const assessment = data.assessment as Record<string, unknown>;

    return withUser(context.userId, async (client) => {
      const { rows: existing } = await client.query<{
        id: string;
        question_id: string | null;
        status: string;
        severity: string;
      }>(
        "SELECT id, question_id, status, severity FROM public.findings WHERE assessment_id = $1",
        [assessment.id],
      );
      const existingByQuestion = new Map(
        existing.filter((f) => f.question_id).map((f) => [f.question_id as string, f]),
      );
      const missing = data.failing.filter((q) => !existingByQuestion.has(q.questionId));

      let created = 0;
      for (const q of missing) {
        const { rows: codeRows } = await client.query("SELECT public.next_finding_code() AS code");
        await client.query(
          `INSERT INTO public.findings
             (finding_code, organization_id, facility_id, assessment_id, question_id, category_name,
              severity, status, description, business_impact, recommended_action, root_cause, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,'critical','open',$7,$8,$9,$10,$11)`,
          [
            codeRows[0]?.code ?? null,
            assessment.organization_id,
            assessment.facility_id,
            assessment.id,
            q.questionId,
            q.categoryName,
            q.questionText,
            "Critical control scored at or below 1 — the facility cannot be rated Production Ready until this is closed.",
            q.guidanceText ?? "Define, document and verify this critical control.",
            q.comments,
            data.actorId ?? null,
          ],
        );
        created += 1;
      }

      const failingIds = new Set(data.failing.map((q) => q.questionId));
      const retirable = existing.filter(
        (f) => f.severity === "critical" && f.status === "open" && f.question_id && !failingIds.has(f.question_id),
      );
      if (retirable.length > 0) {
        await client.query(
          "DELETE FROM public.findings WHERE id = ANY($1)",
          [retirable.map((f) => f.id)],
        );
      }

      return { created, retired: retirable.length };
    });
  });
