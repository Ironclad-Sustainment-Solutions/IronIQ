/**
 * IronIQ scoring engine.
 *
 * All readiness, confidence, completion, gating and finding-generation logic
 * lives here as pure functions. Visual components must never recompute scores.
 *
 * Category Score = Σ(score × question weight) ÷ (5 × Σ applicable question weights) × 100
 * Overall Score  = Σ(category score × category weight) ÷ Σ(applicable category weights)
 *
 * Unanswered questions are excluded from the denominator — they are never
 * treated as zero.
 */

import {
  EVIDENCE_STRENGTH,
  type AssessmentCategory,
  type AssessmentQuestion,
  type AssessmentResponse,
  type FindingSeverity,
} from "./domain";

export type ReadinessLevel =
  | "Advanced"
  | "Production Ready"
  | "Conditionally Ready"
  | "Needs Improvement"
  | "High Risk";

export const READINESS_LEVELS: {
  level: ReadinessLevel;
  min: number;
  max: number;
  token: string;
}[] = [
  { level: "Advanced", min: 90, max: 100, token: "success" },
  { level: "Production Ready", min: 80, max: 89.9, token: "success" },
  { level: "Conditionally Ready", min: 70, max: 79.9, token: "medium" },
  { level: "Needs Improvement", min: 60, max: 69.9, token: "high" },
  { level: "High Risk", min: 0, max: 59.9, token: "critical" },
];

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Runtime validation: scores must be integers 0..5. */
export function isValidScore(score: unknown): score is number {
  return (
    typeof score === "number" &&
    Number.isInteger(score) &&
    score >= 0 &&
    score <= 5
  );
}

/** Runtime validation: category weights must total 100%. */
export function validateCategoryWeights(
  categories: Pick<AssessmentCategory, "weight">[],
): {
  valid: boolean;
  total: number;
} {
  const total = round1(
    categories.reduce((sum, c) => sum + Number(c.weight), 0),
  );
  return { valid: Math.abs(total - 100) < 0.05, total };
}

export function validateQuestionWeight(weight: unknown): boolean {
  return typeof weight === "number" && weight > 0;
}

export interface ScoredQuestion {
  question: AssessmentQuestion;
  response?: AssessmentResponse;
}

export interface CategoryResult {
  category: AssessmentCategory;
  /** null when no applicable question in the category has been answered. */
  score: number | null;
  answered: number;
  applicable: number;
  criticalFailures: AssessmentQuestion[];
}

export interface AssessmentResult {
  categories: CategoryResult[];
  /** Weighted Manufacturing Readiness Score, one decimal. Null when nothing answered. */
  overallScore: number | null;
  /** Evidence-strength Confidence Score, one decimal. Reported separately. */
  confidenceScore: number | null;
  completionPct: number;
  answered: number;
  applicable: number;
  /** Level after the critical gating rule has been applied. */
  readinessLevel: ReadinessLevel | null;
  /** Level implied purely by the numeric score, before gating. */
  rawReadinessLevel: ReadinessLevel | null;
  criticalFailures: AssessmentQuestion[];
  hasCriticalFailure: boolean;
  gated: boolean;
  isComplete: boolean;
}

function isApplicable(item: ScoredQuestion): boolean {
  return !item.response?.not_applicable;
}

function isAnswered(item: ScoredQuestion): boolean {
  return isApplicable(item) && isValidScore(item.response?.score);
}

/** Category Score = Σ(score × weight) ÷ (5 × Σ weights answered) × 100 */
export function computeCategoryScore(items: ScoredQuestion[]): number | null {
  const answered = items.filter(isAnswered);
  if (answered.length === 0) return null;
  const weightSum = answered.reduce(
    (sum, i) => sum + Number(i.question.weight),
    0,
  );
  if (weightSum <= 0) return null;
  const weighted = answered.reduce(
    (sum, i) => sum + Number(i.response!.score) * Number(i.question.weight),
    0,
  );
  return round1((weighted / (5 * weightSum)) * 100);
}

/** Confidence Score from the strongest evidence attached to each answered question. */
export function computeConfidenceScore(items: ScoredQuestion[]): number | null {
  const answered = items.filter(isAnswered);
  if (answered.length === 0) return null;
  const total = answered.reduce(
    (sum, i) => sum + EVIDENCE_STRENGTH[i.response?.evidence_type ?? "none"],
    0,
  );
  return round1(total / answered.length);
}

export function readinessLevelFor(score: number): ReadinessLevel {
  const match = READINESS_LEVELS.find(
    (l) => score >= l.min && score <= l.max + 0.049,
  );
  return match?.level ?? "High Risk";
}

export function readinessToken(level: ReadinessLevel | null): string {
  return READINESS_LEVELS.find((l) => l.level === level)?.token ?? "steel";
}

/**
 * Critical gating rule: a facility must never be labeled Production Ready or
 * Advanced while any critical question is scored 0 or 1.
 */
export function applyCriticalGate(
  level: ReadinessLevel,
  hasCriticalFailure: boolean,
): { level: ReadinessLevel; gated: boolean } {
  if (!hasCriticalFailure) return { level, gated: false };
  if (level === "Advanced" || level === "Production Ready") {
    return { level: "Conditionally Ready", gated: true };
  }
  return { level, gated: false };
}

export function isCriticalFailure(item: ScoredQuestion): boolean {
  return (
    item.question.is_critical &&
    isAnswered(item) &&
    (item.response!.score === 0 || item.response!.score === 1)
  );
}

/**
 * Findings are generated automatically when a critical question scores 0-1 or a
 * non-critical question scores 0-2.
 */
export function autoFindingSeverity(
  item: ScoredQuestion,
): FindingSeverity | null {
  if (!isAnswered(item)) return null;
  const score = item.response!.score as number;
  if (item.question.is_critical) {
    if (score <= 1) return "critical";
    return null;
  }
  if (score === 0) return "high";
  if (score === 1) return "high";
  if (score === 2) return "medium";
  return null;
}

export function generateFindings(
  items: ScoredQuestion[],
  categoryOf: (q: AssessmentQuestion) => string,
) {
  return items
    .map((item) => {
      const severity = autoFindingSeverity(item);
      if (!severity) return null;
      return {
        questionId: item.question.id,
        questionCode: item.question.question_code,
        categoryName: categoryOf(item.question),
        severity,
        score: item.response!.score as number,
        description: item.question.question_text,
        comments: item.response?.comments ?? null,
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);
}

export function computeAssessmentResult(
  categories: AssessmentCategory[],
  questions: AssessmentQuestion[],
  responses: AssessmentResponse[],
): AssessmentResult {
  const responseByQuestion = new Map(responses.map((r) => [r.question_id, r]));
  const allItems: ScoredQuestion[] = questions.map((question) => ({
    question,
    response: responseByQuestion.get(question.id),
  }));

  const ordered = [...categories].sort((a, b) => a.sort_order - b.sort_order);

  const categoryResults: CategoryResult[] = ordered.map((category) => {
    const items = allItems.filter(
      (i) => i.question.category_id === category.id,
    );
    const applicableItems = items.filter(isApplicable);
    return {
      category,
      score: computeCategoryScore(items),
      answered: items.filter(isAnswered).length,
      applicable: applicableItems.length,
      criticalFailures: items.filter(isCriticalFailure).map((i) => i.question),
    };
  });

  const scored = categoryResults.filter((c) => c.score !== null);
  const weightSum = scored.reduce(
    (sum, c) => sum + Number(c.category.weight),
    0,
  );
  const overallScore =
    scored.length > 0 && weightSum > 0
      ? round1(
          scored.reduce(
            (sum, c) => sum + (c.score as number) * Number(c.category.weight),
            0,
          ) / weightSum,
        )
      : null;

  const applicable = allItems.filter(isApplicable).length;
  const answered = allItems.filter(isAnswered).length;
  const completionPct =
    applicable === 0 ? 0 : round1((answered / applicable) * 100);

  const criticalFailures = allItems
    .filter(isCriticalFailure)
    .map((i) => i.question);
  const hasCriticalFailure = criticalFailures.length > 0;

  const isComplete = applicable > 0 && answered === applicable;
  // A readiness level is only awarded once every applicable question is answered —
  // a partially scored assessment must never be published as "Production Ready".
  const rawReadinessLevel =
    overallScore === null || !isComplete
      ? null
      : readinessLevelFor(overallScore);
  const gate = rawReadinessLevel
    ? applyCriticalGate(rawReadinessLevel, hasCriticalFailure)
    : { level: null, gated: false };

  return {
    categories: categoryResults,
    overallScore,
    confidenceScore: computeConfidenceScore(allItems),
    completionPct,
    answered,
    applicable,
    readinessLevel: gate.level,
    rawReadinessLevel,
    criticalFailures,
    hasCriticalFailure,
    gated: gate.gated,
    isComplete,
  };
}

export function formatScore(
  score: number | null | undefined,
  suffix = "",
): string {
  if (score === null || score === undefined || Number.isNaN(Number(score)))
    return "—";
  return `${round1(Number(score)).toFixed(1)}${suffix}`;
}
