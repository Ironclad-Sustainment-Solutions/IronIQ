/**
 * Assessment workflow side-effects: persisting rolled-up scores onto the
 * assessment row and keeping auto-generated critical findings in sync with the
 * responses. All maths lives in scoring.ts — this module only persists it,
 * via server functions (src/lib/assessment-workflow.functions.ts).
 */

import * as fn from "@/lib/assessment-workflow.functions";
import type {
  Assessment,
  AssessmentCategory,
  AssessmentQuestion,
  AssessmentResponse,
} from "./domain";
import { isValidScore, type AssessmentResult } from "./scoring";

/** Rolls the live computed result onto the assessment row. */
export async function persistAssessmentAggregates(
  assessmentId: string,
  result: AssessmentResult,
  extra: Record<string, unknown> = {},
) {
  await fn.persistAssessmentAggregates({
    data: {
      assessmentId,
      overallScore: result.overallScore,
      confidenceScore: result.confidenceScore,
      completionPct: result.completionPct,
      readinessLevel: result.readinessLevel,
      hasCriticalFailure: result.hasCriticalFailure,
      extra,
    },
  });
}

/**
 * A critical control scored 0 or 1 must always be represented by an open
 * critical finding. Raising the score above 1 retires the auto-generated
 * finding while it is still untouched (status `open`).
 */
export async function syncCriticalFindings(
  assessment: Assessment,
  categories: AssessmentCategory[],
  questions: AssessmentQuestion[],
  responses: AssessmentResponse[],
  actorId?: string | null,
): Promise<{ created: number; retired: number }> {
  const responseByQuestion = new Map(responses.map((r) => [r.question_id, r]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  const failing = questions
    .filter((q) => {
      const r = responseByQuestion.get(q.id);
      if (!q.is_critical || !r || r.not_applicable) return false;
      return isValidScore(r.score) && (r.score as number) <= 1;
    })
    .map((q) => ({
      questionId: q.id,
      categoryId: q.category_id,
      categoryName: categoryName.get(q.category_id) ?? null,
      questionText: q.question_text,
      guidanceText: q.guidance_text ?? null,
      comments: responseByQuestion.get(q.id)?.comments ?? null,
    }));

  return fn.syncCriticalFindings({
    data: { assessment, failing, actorId: actorId ?? null },
  });
}
