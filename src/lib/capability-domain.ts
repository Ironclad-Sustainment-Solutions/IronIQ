/**
 * IronIQ Performance-Based Capability Assessment — domain model.
 *
 * The model is performance-based, not compliance-based: every criterion is
 * scored against five performance dimensions rather than a yes/no existence
 * check.
 */

export type CapAssessmentStatus =
  "draft" | "intake" | "in_progress" | "review" | "finalized" | "reopened";

export const CAP_STATUS_LABELS: Record<CapAssessmentStatus, string> = {
  draft: "Draft",
  intake: "Intake",
  in_progress: "In Progress",
  review: "In Review",
  finalized: "Finalized",
  reopened: "Reopened",
};

export type CapPerfCategory =
  | "production"
  | "quality"
  | "cost"
  | "delivery"
  | "workforce"
  | "throughput"
  | "downtime"
  | "capacity"
  | "scrap_rework"
  | "setup_time"
  | "lead_time"
  | "reliability";

export const PERF_CATEGORY_LABELS: Record<CapPerfCategory, string> = {
  production: "Production",
  quality: "Quality",
  cost: "Cost",
  delivery: "Delivery",
  workforce: "Workforce",
  throughput: "Throughput",
  downtime: "Downtime",
  capacity: "Capacity",
  scrap_rework: "Scrap / Rework",
  setup_time: "Setup Time",
  lead_time: "Lead Time",
  reliability: "Reliability",
};

export const PERF_CATEGORIES = Object.keys(
  PERF_CATEGORY_LABELS,
) as CapPerfCategory[];

export type CapDimension =
  "availability" | "capability" | "consistency" | "control" | "sustainability";

export const DIMENSIONS: {
  key: CapDimension;
  label: string;
  question: string;
}[] = [
  {
    key: "availability",
    label: "Availability",
    question: "Is the capability available when and where production needs it?",
  },
  {
    key: "capability",
    label: "Capability",
    question:
      "Can it actually perform the required function and achieve the required result?",
  },
  {
    key: "consistency",
    label: "Consistency",
    question:
      "Does it produce repeatable results across jobs, shifts, machines, operators and time?",
  },
  {
    key: "control",
    label: "Control",
    question:
      "Is it documented, controlled, measurable and protected from uncontrolled variation?",
  },
  {
    key: "sustainability",
    label: "Sustainability",
    question:
      "Can the organization maintain the capability through personnel, workload and equipment change?",
  },
];

export const DIMENSION_LABELS = Object.fromEntries(
  DIMENSIONS.map((d) => [d.key, d.label]),
) as Record<CapDimension, string>;

/** 0–5 maturity / performance scale. */
export const MATURITY_SCALE: {
  value: number;
  label: string;
  description: string;
  token: string;
}[] = [
  {
    value: 0,
    label: "Absent",
    description: "Required capability does not exist.",
    token: "critical",
  },
  {
    value: 1,
    label: "Critical",
    description:
      "Exists minimally or informally but cannot reliably support production.",
    token: "critical",
  },
  {
    value: 2,
    label: "Constrained",
    description:
      "Functions in some situations but regularly creates performance limitations.",
    token: "high",
  },
  {
    value: 3,
    label: "Functional",
    description:
      "Generally supports requirements but contains measurable weaknesses or variability.",
    token: "medium",
  },
  {
    value: 4,
    label: "Controlled",
    description:
      "Reliable, documented, measured and consistently supports operational requirements.",
    token: "success",
  },
  {
    value: 5,
    label: "Resilient",
    description:
      "Optimized, sustainable, measured, continuously improved and resistant to disruption.",
    token: "success",
  },
];

export type CapEvidenceType =
  | "direct_observation"
  | "customer_interview"
  | "document_review"
  | "production_data"
  | "quality_data"
  | "erp_mes_data"
  | "machine_data"
  | "photograph"
  | "file"
  | "drawing"
  | "cnc_program"
  | "setup_documentation"
  | "maintenance_record"
  | "training_record"
  | "other";

export const EVIDENCE_TYPE_LABELS: Record<CapEvidenceType, string> = {
  direct_observation: "Direct Observation",
  customer_interview: "Customer Interview",
  document_review: "Document Review",
  production_data: "Production Data",
  quality_data: "Quality Data",
  erp_mes_data: "ERP / MES Data",
  machine_data: "Machine Data",
  photograph: "Photographs",
  file: "Files",
  drawing: "Drawings",
  cnc_program: "CNC Programs",
  setup_documentation: "Setup Documentation",
  maintenance_record: "Maintenance Records",
  training_record: "Training Records",
  other: "Other",
};

export type CapConfidence = "low" | "moderate" | "high" | "verified";
export const CONFIDENCE_LABELS: Record<CapConfidence, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  verified: "Verified",
};

export type CapFindingClass =
  | "primary_constraint"
  | "contributing_constraint"
  | "risk"
  | "opportunity"
  | "strength";

export const FINDING_CLASS_LABELS: Record<CapFindingClass, string> = {
  primary_constraint: "Primary Constraint",
  contributing_constraint: "Contributing Constraint",
  risk: "Risk",
  opportunity: "Improvement Opportunity",
  strength: "Strength",
};

export type CapSource = "customer_stated" | "ironclad_validated";
export const SOURCE_LABELS: Record<CapSource, string> = {
  customer_stated: "Customer-Stated",
  ironclad_validated: "Ironclad-Validated",
};

export type CapPriority = "immediate" | "high" | "moderate" | "monitor";
export const PRIORITY_LABELS: Record<CapPriority, string> = {
  immediate: "Immediate",
  high: "High",
  moderate: "Moderate",
  monitor: "Monitor",
};

export type CapActionStatus =
  | "identified"
  | "recommended"
  | "approved"
  | "in_progress"
  | "validation"
  | "complete"
  | "sustained";

export const ACTION_STATUS_LABELS: Record<CapActionStatus, string> = {
  identified: "Identified",
  recommended: "Recommended",
  approved: "Approved",
  in_progress: "In Progress",
  validation: "Validation",
  complete: "Complete",
  sustained: "Sustained",
};

export const ACTION_STATUS_ORDER: CapActionStatus[] = [
  "identified",
  "recommended",
  "approved",
  "in_progress",
  "validation",
  "complete",
  "sustained",
];

export type CapValidationResult =
  | "capability_restored"
  | "capability_strengthened"
  | "partially_restored"
  | "additional_action_required"
  | "performance_degraded";

export const VALIDATION_RESULT_LABELS: Record<CapValidationResult, string> = {
  capability_restored: "Capability Restored",
  capability_strengthened: "Capability Strengthened",
  partially_restored: "Partially Restored",
  additional_action_required: "Additional Action Required",
  performance_degraded: "Performance Degraded",
};

export type CapSeverity =
  "critical" | "high" | "medium" | "low" | "opportunity";

/** The five discovery questions asked at the start of every assessment. */
export const INTAKE_QUESTIONS: { key: IntakeKey; label: string }[] = [
  {
    key: "q_greatest_impact",
    label:
      "What problem is having the greatest impact on your operation right now?",
  },
  {
    key: "q_where_when",
    label: "Where and when does the problem become most visible?",
  },
  {
    key: "q_effect",
    label:
      "How is it affecting production, quality, cost, delivery or workforce performance?",
  },
  { key: "q_tried", label: "What have you already tried, and what happened?" },
  {
    key: "q_if_resolved",
    label: "What would improve if this problem were successfully resolved?",
  },
];

export type IntakeKey =
  | "q_greatest_impact"
  | "q_where_when"
  | "q_effect"
  | "q_tried"
  | "q_if_resolved";

export const SUSTAINMENT_QUESTIONS: { key: SustainmentKey; label: string }[] = [
  { key: "improvement_holding", label: "Is the improvement still working?" },
  { key: "repeatable", label: "Is performance repeatable?" },
  { key: "process_controlled", label: "Is the process controlled?" },
  { key: "knowledge_documented", label: "Is knowledge documented?" },
  { key: "others_can_execute", label: "Can other employees execute it?" },
  { key: "performance_measured", label: "Is performance being measured?" },
  { key: "capability_stable", label: "Has the capability remained stable?" },
];

export type SustainmentKey =
  | "improvement_holding"
  | "repeatable"
  | "process_controlled"
  | "knowledge_documented"
  | "others_can_execute"
  | "performance_measured"
  | "capability_stable";

/* ---------- Row types ---------- */

export interface CapDomainRow {
  id: string;
  code: string;
  name: string;
  verb: string;
  key_question: string;
  sort_order: number;
}

export interface CapCriterionRow {
  id: string;
  domain_id: string;
  name: string;
  description: string | null;
  sort_order: number;
}

export interface CapAssessmentRow {
  id: string;
  organization_id: string;
  facility_id: string | null;
  name: string;
  assessment_date: string;
  lead_assessor: string | null;
  scope: string | null;
  status: CapAssessmentStatus;
  overall_score: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  modified_by: string | null;
}

export interface CapProblemRow {
  id: string;
  assessment_id: string;
  q_greatest_impact: string | null;
  q_where_when: string | null;
  q_effect: string | null;
  q_tried: string | null;
  q_if_resolved: string | null;
  stated_problem: string | null;
  location_process: string | null;
  performance_impact: string | null;
  previous_actions: string | null;
  desired_outcome: string | null;
  entered_by_role: string | null;
}

export interface CapImpactRow {
  id: string;
  assessment_id: string;
  category: CapPerfCategory;
  current_condition: string | null;
  desired_condition: string | null;
  metric_name: string | null;
  current_value: number | null;
  target_value: number | null;
  unit: string | null;
  data_source: string | null;
  evidence: string | null;
  assessor_notes: string | null;
}

export interface CapScoreRow {
  id: string;
  assessment_id: string;
  criterion_id: string;
  dimension: CapDimension;
  score: number | null;
  not_applicable: boolean;
  rationale: string | null;
  confidence: CapConfidence | null;
}

export interface CapFindingRow {
  id: string;
  assessment_id: string;
  title: string;
  finding_text: string | null;
  domain_id: string | null;
  dimension: CapDimension | null;
  classification: CapFindingClass;
  severity: CapSeverity;
  confidence: CapConfidence;
  source: CapSource;
  assessor_notes: string | null;
  ai_generated: boolean;
  approved: boolean;
  client_visible: boolean;
  created_at: string;
}

export interface CapEvidenceRow {
  id: string;
  finding_id: string;
  evidence_type: CapEvidenceType;
  description: string | null;
  source: string | null;
  file_path: string | null;
  captured_on: string | null;
}

export interface CapFindingLinkRow {
  id: string;
  parent_finding_id: string;
  child_finding_id: string;
  relation: string;
}

export interface CapRootGapRow {
  id: string;
  assessment_id: string;
  observed_problem: string;
  immediate_cause: string | null;
  contributing_factors: string | null;
  root_gap: string;
  domain_id: string | null;
  dimension: CapDimension | null;
  operational_consequence: string | null;
  validated: boolean;
  confidence: CapConfidence;
  primary_finding_id: string | null;
}

export interface CapActionRow {
  id: string;
  assessment_id: string;
  root_gap_id: string | null;
  capability_gap: string | null;
  recommended_action: string;
  expected_outcome: string | null;
  metric_name: string | null;
  baseline_value: number | null;
  target_value: number | null;
  unit: string | null;
  responsible_party: string | null;
  target_date: string | null;
  status: CapActionStatus;
  required_resources: string | null;
  estimated_effort: string | null;
  dependencies: string | null;
  validation_method: string | null;
  priority: CapPriority;
  priority_score: number | null;
  priority_override_justification: string | null;
  impact_rating: number | null;
  urgency_rating: number | null;
  severity_rating: number | null;
  frequency_rating: number | null;
  cost_exposure: number | null;
  delivery_exposure: number | null;
  quality_exposure: number | null;
  workforce_dependency: number | null;
  ease_of_restoration: number | null;
  expected_benefit: number | null;
  confidence_rating: number | null;
  ai_generated: boolean;
  approved: boolean;
}

export interface CapResultRow {
  id: string;
  action_id: string;
  measured_on: string;
  actual_value: number;
  notes: string | null;
}

export interface CapValidationRow {
  id: string;
  action_id: string;
  interval_days: number;
  validated_on: string;
  improvement_holding: boolean | null;
  repeatable: boolean | null;
  process_controlled: boolean | null;
  knowledge_documented: boolean | null;
  others_can_execute: boolean | null;
  performance_measured: boolean | null;
  capability_stable: boolean | null;
  result: CapValidationResult;
  notes: string | null;
}
