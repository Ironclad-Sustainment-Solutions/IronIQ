/**
 * Capability scoring engine.
 *
 * Scores are rolled up from criterion × dimension ratings. Unanswered and
 * not-applicable ratings are excluded from every denominator — they are never
 * treated as zero.
 *
 * The overall score must never hide a severe constraint: any rating of 0 or 1
 * is surfaced independently of the averages.
 */

import type {
  CapActionRow,
  CapCriterionRow,
  CapDimension,
  CapDomainRow,
  CapPriority,
  CapResultRow,
  CapScoreRow,
} from "./capability-domain";
import { DIMENSIONS } from "./capability-domain";

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function isRated(s: CapScoreRow | undefined): s is CapScoreRow {
  return Boolean(s) && !s!.not_applicable && typeof s!.score === "number";
}

export interface CriterionResult {
  criterion: CapCriterionRow;
  /** Average across rated dimensions, 0–5. Null when nothing is rated. */
  score: number | null;
  rated: number;
  byDimension: Record<CapDimension, CapScoreRow | undefined>;
  severe: boolean;
}

export interface DomainResult {
  domain: CapDomainRow;
  criteria: CriterionResult[];
  /** Average across rated criteria, 0–5. */
  score: number | null;
  /** Same score expressed 0–100. */
  percent: number | null;
  ratedCount: number;
  totalCount: number;
  dimensionScores: Record<CapDimension, number | null>;
  severeCount: number;
  weakest: CriterionResult | null;
}

export interface CapabilityResult {
  domains: DomainResult[];
  overall: number | null;
  overallPercent: number | null;
  completionPct: number;
  severeCount: number;
  severeCriteria: {
    domain: CapDomainRow;
    criterion: CapCriterionRow;
    dimension: CapDimension;
    score: number;
  }[];
}

export function computeCapability(
  domains: CapDomainRow[],
  criteria: CapCriterionRow[],
  scores: CapScoreRow[],
): CapabilityResult {
  const byKey = new Map(
    scores.map((s) => [`${s.criterion_id}:${s.dimension}`, s]),
  );
  const severeCriteria: CapabilityResult["severeCriteria"] = [];
  let ratedTotal = 0;
  let slotTotal = 0;

  const domainResults = [...domains]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map<DomainResult>((domain) => {
      const domainCriteria = criteria
        .filter((c) => c.domain_id === domain.id)
        .sort((a, b) => a.sort_order - b.sort_order);

      const criteriaResults = domainCriteria.map<CriterionResult>(
        (criterion) => {
          const byDimension = {} as Record<
            CapDimension,
            CapScoreRow | undefined
          >;
          const values: number[] = [];
          let severe = false;
          for (const d of DIMENSIONS) {
            const row = byKey.get(`${criterion.id}:${d.key}`);
            byDimension[d.key] = row;
            slotTotal += 1;
            if (isRated(row)) {
              ratedTotal += 1;
              values.push(row.score as number);
              if ((row.score as number) <= 1) {
                severe = true;
                severeCriteria.push({
                  domain,
                  criterion,
                  dimension: d.key,
                  score: row.score as number,
                });
              }
            }
          }
          return {
            criterion,
            score: values.length
              ? round1(values.reduce((a, b) => a + b, 0) / values.length)
              : null,
            rated: values.length,
            byDimension,
            severe,
          };
        },
      );

      const rated = criteriaResults.filter((c) => c.score !== null);
      const score = rated.length
        ? round1(
            rated.reduce((sum, c) => sum + (c.score as number), 0) /
              rated.length,
          )
        : null;

      const dimensionScores = {} as Record<CapDimension, number | null>;
      for (const d of DIMENSIONS) {
        const vals = criteriaResults
          .map((c) => c.byDimension[d.key])
          .filter(isRated)
          .map((r) => r.score as number);
        dimensionScores[d.key] = vals.length
          ? round1(vals.reduce((a, b) => a + b, 0) / vals.length)
          : null;
      }

      const weakest = rated.length
        ? rated.reduce((min, c) =>
            (c.score as number) < (min.score as number) ? c : min,
          )
        : null;

      return {
        domain,
        criteria: criteriaResults,
        score,
        percent: score === null ? null : round1((score / 5) * 100),
        ratedCount: rated.length,
        totalCount: criteriaResults.length,
        dimensionScores,
        severeCount: criteriaResults.filter((c) => c.severe).length,
        weakest,
      };
    });

  const scored = domainResults.filter((d) => d.score !== null);
  const overall = scored.length
    ? round1(
        scored.reduce((sum, d) => sum + (d.score as number), 0) / scored.length,
      )
    : null;

  return {
    domains: domainResults,
    overall,
    overallPercent: overall === null ? null : round1((overall / 5) * 100),
    completionPct: slotTotal === 0 ? 0 : round1((ratedTotal / slotTotal) * 100),
    severeCount: severeCriteria.length,
    severeCriteria,
  };
}

export function scoreToken(score: number | null): string {
  if (score === null) return "steel";
  if (score <= 1) return "critical";
  if (score < 3) return "high";
  if (score < 4) return "medium";
  return "success";
}

/* ---------- Prioritization ---------- */

export const PRIORITY_FACTORS: {
  key: keyof CapActionRow;
  label: string;
  invert?: boolean;
}[] = [
  { key: "impact_rating", label: "Operational Impact" },
  { key: "urgency_rating", label: "Urgency" },
  { key: "severity_rating", label: "Severity" },
  { key: "frequency_rating", label: "Frequency" },
  { key: "cost_exposure", label: "Cost Exposure" },
  { key: "delivery_exposure", label: "Delivery Exposure" },
  { key: "quality_exposure", label: "Quality Exposure" },
  { key: "workforce_dependency", label: "Workforce Dependency" },
  { key: "ease_of_restoration", label: "Ease of Restoration" },
  { key: "expected_benefit", label: "Expected Benefit" },
  { key: "confidence_rating", label: "Confidence in Finding" },
];

/** Suggested priority — advisory only. The assessor may override with justification. */
export function suggestedPriority(action: Partial<CapActionRow>): {
  score: number | null;
  priority: CapPriority | null;
} {
  const values = PRIORITY_FACTORS.map(
    (f) => action[f.key] as number | null | undefined,
  ).filter((v): v is number => typeof v === "number");
  if (values.length === 0) return { score: null, priority: null };
  const score = round1(values.reduce((a, b) => a + b, 0) / values.length);
  const priority: CapPriority =
    score >= 4.2
      ? "immediate"
      : score >= 3.4
        ? "high"
        : score >= 2.4
          ? "moderate"
          : "monitor";
  return { score, priority };
}

/* ---------- Measured improvement ---------- */

export interface ImprovementSummary {
  baseline: number | null;
  target: number | null;
  actual: number | null;
  absolute: number | null;
  percent: number | null;
  targetAchieved: boolean | null;
  /** true when lower values are better (target below baseline). */
  lowerIsBetter: boolean;
  trend: "improving" | "declining" | "flat" | "unknown";
}

export function summarizeImprovement(
  action: Pick<CapActionRow, "baseline_value" | "target_value">,
  results: CapResultRow[],
): ImprovementSummary {
  const ordered = [...results].sort(
    (a, b) =>
      new Date(a.measured_on).getTime() - new Date(b.measured_on).getTime(),
  );
  const latest = ordered.at(-1)?.actual_value ?? null;
  const previous =
    ordered.length > 1 ? (ordered.at(-2)?.actual_value ?? null) : null;
  const baseline = action.baseline_value;
  const target = action.target_value;
  const lowerIsBetter =
    baseline !== null && target !== null ? target < baseline : false;

  if (baseline === null || latest === null) {
    return {
      baseline,
      target,
      actual: latest,
      absolute: null,
      percent: null,
      targetAchieved: null,
      lowerIsBetter,
      trend: "unknown",
    };
  }

  const absolute = round1(latest - baseline);
  const percent =
    baseline === 0
      ? null
      : round1(((latest - baseline) / Math.abs(baseline)) * 100);
  const targetAchieved =
    target === null
      ? null
      : lowerIsBetter
        ? latest <= target
        : latest >= target;

  let trend: ImprovementSummary["trend"] = "flat";
  if (previous !== null && previous !== latest) {
    const better = lowerIsBetter ? latest < previous : latest > previous;
    trend = better ? "improving" : "declining";
  }

  return {
    baseline,
    target,
    actual: latest,
    absolute,
    percent,
    targetAchieved,
    lowerIsBetter,
    trend,
  };
}

export function formatValue(
  v: number | null | undefined,
  unit?: string | null,
): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "—";
  const n = Number(v);
  const text = Number.isInteger(n) ? String(n) : String(round1(n));
  return unit ? `${text} ${unit}` : text;
}
