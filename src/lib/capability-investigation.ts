/**
 * Manufacturing Capability Assessment — investigation model.
 *
 * Covers the stages between the customer's stated problem and the prioritized
 * restoration actions: performance gap, operational observation, six-domain
 * screen, targeted deep dive, constraint chain, primary constraint, root
 * capability gap and the capability health sweep.
 */

import type { CapConfidence, CapEvidenceType, CapPerfCategory } from "./capability-domain";

/* ---------- Step 4: domain screen ---------- */

export type ScreenStatus =
  | "not_screened"
  | "healthy"
  | "potential_contributor"
  | "confirmed_contributor"
  | "significant_risk"
  | "insufficient_evidence"
  | "not_applicable";

export const SCREEN_STATUS_LABELS: Record<ScreenStatus, string> = {
  not_screened: "Not Screened",
  healthy: "Healthy",
  potential_contributor: "Potential Contributor",
  confirmed_contributor: "Confirmed Contributor",
  significant_risk: "Significant Risk",
  insufficient_evidence: "Not Enough Evidence",
  not_applicable: "Not Applicable",
};

export const SCREEN_STATUS_TOKEN: Record<ScreenStatus, string> = {
  not_screened: "steel",
  healthy: "success",
  potential_contributor: "medium",
  confirmed_contributor: "critical",
  significant_risk: "high",
  insufficient_evidence: "low",
  not_applicable: "steel",
};

export const SCREEN_STATUSES = Object.keys(SCREEN_STATUS_LABELS) as ScreenStatus[];

/** Statuses that open a targeted deep dive (Step 5). */
export const DEEP_DIVE_TRIGGERS: ScreenStatus[] = [
  "potential_contributor",
  "confirmed_contributor",
  "significant_risk",
  "insufficient_evidence",
];

/** Short screen checklists per domain code. */
export const DOMAIN_SCREEN_ITEMS: Record<string, string[]> = {
  technical_data: [
    "Drawings",
    "Specifications",
    "Bills of Material",
    "Revision Control",
    "Product Knowledge",
    "Process Documentation",
    "Technical Requirements",
    "Data Availability",
  ],
  digital_manufacturing: [
    "CAD",
    "CAM",
    "CNC Programs",
    "Digital Manufacturing Packages",
    "Program Revision Control",
    "File Organization",
    "Manufacturing Data Control",
  ],
  production_support: [
    "Tooling",
    "Fixtures",
    "Workholding",
    "Setup Planning",
    "Work Instructions",
    "Inspection Planning",
    "Production Preparation",
  ],
  production_operations: [
    "Workflow",
    "Scheduling",
    "Capacity",
    "Throughput",
    "WIP",
    "Bottlenecks",
    "Changeovers",
    "Downtime",
    "Process Flow",
  ],
  equipment_infrastructure: [
    "Machine Capability",
    "Equipment Availability",
    "Maintenance",
    "Reliability",
    "Facility Layout",
    "Utilities",
    "Material Flow",
    "Infrastructure",
  ],
  workforce_knowledge: [
    "Skills",
    "Staffing",
    "Training",
    "Cross-Training",
    "Tribal Knowledge",
    "Standard Work",
    "Critical Personnel Dependencies",
    "Technical Competency",
  ],
};

/* ---------- Step 8: primary constraint ---------- */

export type ConstraintValidation = "suspected" | "probable" | "validated";

export const CONSTRAINT_VALIDATION_LABELS: Record<ConstraintValidation, string> = {
  suspected: "Suspected",
  probable: "Probable",
  validated: "Validated",
};

export const CONSTRAINT_VALIDATION_TOKEN: Record<ConstraintValidation, string> = {
  suspected: "medium",
  probable: "high",
  validated: "success",
};

/* ---------- Step 10: capability health sweep ---------- */

export type SweepClassification =
  | "healthy"
  | "capability_risk"
  | "improvement_opportunity"
  | "future_constraint"
  | "further_review";

export const SWEEP_LABELS: Record<SweepClassification, string> = {
  healthy: "Healthy",
  capability_risk: "Capability Risk",
  improvement_opportunity: "Improvement Opportunity",
  future_constraint: "Future Constraint",
  further_review: "Requires Further Review",
};

export const SWEEP_TOKEN: Record<SweepClassification, string> = {
  healthy: "success",
  capability_risk: "high",
  improvement_opportunity: "opportunity",
  future_constraint: "medium",
  further_review: "low",
};

/* ---------- Step 7: constraint chain ---------- */

export type ChainStepKey =
  | "customer_problem"
  | "performance_gap"
  | "observed_condition"
  | "constraint"
  | "capability_gap"
  | "operational_consequence";

export const CHAIN_STEPS: { key: ChainStepKey; label: string; hint: string }[] = [
  { key: "customer_problem", label: "Customer Problem", hint: "e.g. Low weekly output" },
  { key: "performance_gap", label: "Performance Gap", hint: "e.g. 150 parts/week short of requirement" },
  { key: "observed_condition", label: "Observed Condition", hint: "e.g. Excessive machine setup time" },
  { key: "constraint", label: "Constraint", hint: "e.g. Fixture configurations differ between cells" },
  { key: "capability_gap", label: "Capability Gap", hint: "e.g. No controlled standardized fixturing system" },
  {
    key: "operational_consequence",
    label: "Operational Consequence",
    hint: "e.g. Lost machine availability and inconsistent cycle startup",
  },
];

/* ---------- Evidence + observation vocabularies ---------- */

export const OBSERVATION_FREQUENCIES = [
  "Every job",
  "Daily",
  "Weekly",
  "Monthly",
  "Intermittent",
  "One-off",
] as const;

export const OBSERVATION_SEVERITIES = ["Critical", "High", "Moderate", "Low"] as const;

export const PERFORMANCE_CATEGORY_OPTIONS: { value: CapPerfCategory | "other"; label: string }[] = [
  { value: "production", label: "Production Output" },
  { value: "throughput", label: "Throughput" },
  { value: "quality", label: "Quality" },
  { value: "scrap_rework", label: "Scrap / Rework" },
  { value: "cost", label: "Cost" },
  { value: "delivery", label: "Delivery" },
  { value: "lead_time", label: "Lead Time" },
  { value: "setup_time", label: "Setup Time" },
  { value: "downtime", label: "Downtime" },
  { value: "capacity", label: "Capacity" },
  { value: "reliability", label: "Machine Utilization / Reliability" },
  { value: "workforce", label: "Workforce & Labor Productivity" },
  { value: "other", label: "Other" },
];

/* ---------- Row types ---------- */

export interface CapMetricRow {
  id: string;
  assessment_id: string;
  organization_id: string | null;
  category: CapPerfCategory;
  other_label: string | null;
  metric_name: string | null;
  current_condition: string | null;
  current_value: number | null;
  required_value: number | null;
  target_value: number | null;
  unit: string | null;
  time_period: string | null;
  data_source: string | null;
  confidence: CapConfidence | null;
  higher_is_better: boolean;
  notes: string | null;
}

export interface CapObservationRow {
  id: string;
  assessment_id: string;
  organization_id: string | null;
  area_process: string | null;
  machine_cell: string | null;
  observation: string;
  performance_effect: string | null;
  frequency: string | null;
  severity: string | null;
  evidence_type: CapEvidenceType | null;
  evidence_note: string | null;
  file_path: string | null;
  assessor_notes: string | null;
  domain_id: string | null;
}

export interface CapDomainScreenRow {
  id: string;
  assessment_id: string;
  domain_id: string;
  status: ScreenStatus;
  screen_items: string[];
  notes: string | null;
}

export interface CapChainNodeRow {
  id: string;
  assessment_id: string;
  step_key: ChainStepKey;
  content: string | null;
  sort_order: number;
}

export interface CapPrimaryConstraintRow {
  id: string;
  assessment_id: string;
  constraint_text: string | null;
  supporting_evidence: string | null;
  domain_id: string | null;
  metric_affected: string | null;
  magnitude: string | null;
  confidence: CapConfidence | null;
  validation_status: ConstraintValidation;
  declared_at: string | null;
}

export interface CapHealthSweepRow {
  id: string;
  assessment_id: string;
  domain_id: string;
  classification: SweepClassification;
  note: string | null;
}

/* ---------- Gap math ---------- */

export interface MetricGap {
  gap: number | null;
  /** true when current performance already meets or beats the requirement. */
  met: boolean;
  percentOfRequired: number | null;
  label: string;
}

/**
 * Performance Gap = Required Performance − Current Performance.
 * For "lower is better" metrics (scrap, downtime, setup time, cost, lead time)
 * the sign is flipped so a positive gap always means "work to do".
 */
export function metricGap(m: Pick<CapMetricRow, "current_value" | "required_value" | "higher_is_better" | "unit">): MetricGap {
  const cur = m.current_value;
  const req = m.required_value;
  if (cur === null || cur === undefined || req === null || req === undefined) {
    return { gap: null, met: false, percentOfRequired: null, label: "—" };
  }
  const raw = m.higher_is_better ? req - cur : cur - req;
  const gap = Math.round(raw * 1000) / 1000;
  const pct = req === 0 ? null : Math.round((cur / req) * 1000) / 10;
  const unit = m.unit ? ` ${m.unit}` : "";
  return {
    gap,
    met: gap <= 0,
    percentOfRequired: pct,
    label: `${gap > 0 ? "" : "+"}${Math.abs(gap)}${unit}`,
  };
}

export function metricTitle(m: Pick<CapMetricRow, "metric_name" | "other_label" | "category">, categoryLabel: string) {
  return m.metric_name?.trim() || m.other_label?.trim() || categoryLabel;
}
