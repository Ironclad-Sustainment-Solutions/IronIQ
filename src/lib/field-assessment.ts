/**
 * Field Assessment — fast shop-floor capture that produces a capability score.
 *
 * One 0–5 rating per capability domain. Unrated and not-applicable domains are
 * excluded from the denominator; they are never treated as zero.
 */

import { round1 } from "./capability-scoring";

export interface FieldAssessmentRow {
  id: string;
  organization_id: string;
  facility_id: string | null;
  area: string;
  work_center: string | null;
  shift: string | null;
  observer_name: string | null;
  notes: string | null;
  status: string;
  capability_score: number | null;
  observed_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client_name: string | null;
  assessors: string | null;
  primary_concern: string | null;
  problem_statement: string | null;
  problem_area: string | null;
  problem_process: string | null;
  problem_timing: string | null;
  impact_tags: string[];
  impact_other: string | null;
  attempted: string | null;
  improvement_if_resolved: string | null;
  workstreams: string[];
  recommendation: string | null;
  summary_observed: string | null;
  summary_constraint: string | null;
  summary_why: string | null;
  summary_opportunity: string | null;
  summary_recommendation: string | null;
  summary_outcome: string | null;
}

export interface FieldRatingRow {
  id: string;
  field_assessment_id: string;
  domain_id: string;
  score: number | null;
  not_applicable: boolean;
  note: string | null;
  needs_action: boolean;
  created_at: string;
  updated_at: string;
}

export const SHIFTS = ["1st", "2nd", "3rd", "Weekend"] as const;

/** Short prompts sized for a phone screen, keyed by cap_domains.code. */
export const FIELD_PROMPTS: Record<string, string> = {
  technical_data:
    "Do operators have correct, current drawings and specs at the machine?",
  digital_manufacturing:
    "Are programs, models and digital records available and trusted here?",
  production_support:
    "Do jobs have tooling, fixtures, material and instructions ready on time?",
  production_operations:
    "Is this area running to plan without workarounds or firefighting?",
  equipment_infrastructure:
    "Is the equipment available, accurate and maintained for this work?",
  workforce_knowledge:
    "Can more than one person run this work to the required standard?",
};

export interface FieldResult {
  /** Average of rated domains, 0–5. */
  score: number | null;
  /** Same score expressed 0–100. */
  percent: number | null;
  rated: number;
  total: number;
  completionPct: number;
  severeCount: number;
  actionCount: number;
}

export function computeFieldScore(
  domainIds: string[],
  ratings: FieldRatingRow[],
): FieldResult {
  const byDomain = new Map(ratings.map((r) => [r.domain_id, r]));
  const values: number[] = [];
  let severeCount = 0;
  let actionCount = 0;

  for (const id of domainIds) {
    const row = byDomain.get(id);
    if (row?.needs_action) actionCount += 1;
    if (!row || row.not_applicable || typeof row.score !== "number") continue;
    values.push(row.score);
    if (row.score <= 1) severeCount += 1;
  }

  const applicable = domainIds.filter(
    (id) => !byDomain.get(id)?.not_applicable,
  ).length;
  const score = values.length
    ? round1(values.reduce((a, b) => a + b, 0) / values.length)
    : null;

  return {
    score,
    percent: score === null ? null : round1((score / 5) * 100),
    rated: values.length,
    total: domainIds.length,
    completionPct:
      applicable === 0 ? 100 : round1((values.length / applicable) * 100),
    severeCount,
    actionCount,
  };
}
