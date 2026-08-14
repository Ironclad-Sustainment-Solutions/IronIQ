/**
 * IronIQ domain models.
 * These mirror the Postgres schema and are the single source of
 * truth for typing across the application.
 */

export type AppRole =
  | "ironiq_admin"
  | "consultant"
  | "customer_admin"
  | "facility_manager"
  | "assessor"
  | "executive";

export const ROLE_LABELS: Record<AppRole, string> = {
  ironiq_admin: "IronIQ Administrator",
  consultant: "Ironclad Consultant",
  customer_admin: "Customer Administrator",
  facility_manager: "Facility Manager",
  assessor: "Assessor",
  executive: "Read-Only Executive",
};

export type EntityStatus = "active" | "inactive" | "archived" | "prospect";
export type AssessmentStatus = "draft" | "in_progress" | "review" | "finalized" | "reopened";
export type FindingSeverity = "critical" | "high" | "medium" | "low" | "opportunity";
export type FindingStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "awaiting_verification"
  | "closed"
  | "accepted_risk";
export type EvidenceType =
  | "none"
  | "verbal"
  | "document"
  | "record_sampled"
  | "direct_observation"
  | "system_data";
export type TemplateStatus = "draft" | "published" | "archived";
export type ProjectStatus =
  | "proposed"
  | "planned"
  | "in_progress"
  | "on_hold"
  | "complete"
  | "cancelled";

export const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  opportunity: "Opportunity",
};

export const SEVERITY_ORDER: FindingSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "opportunity",
];

export const FINDING_STATUS_LABELS: Record<FindingStatus, string> = {
  open: "Open",
  assigned: "Assigned",
  in_progress: "In Progress",
  awaiting_verification: "Awaiting Verification",
  closed: "Closed",
  accepted_risk: "Accepted Risk",
};

export const ASSESSMENT_STATUS_LABELS: Record<AssessmentStatus, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  review: "In Review",
  finalized: "Finalized",
  reopened: "Reopened",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  proposed: "Proposed",
  planned: "Planned",
  in_progress: "In Progress",
  on_hold: "On Hold",
  complete: "Complete",
  cancelled: "Cancelled",
};

/** Score anchor definitions — 0 through 5. */
export const SCORE_ANCHORS: { value: number; label: string; description: string }[] = [
  { value: 0, label: "Not present", description: "No process, control, or evidence exists." },
  { value: 1, label: "Ad hoc", description: "Performed inconsistently and dependent on individuals." },
  { value: 2, label: "Partially defined", description: "Partially documented; application is uneven." },
  { value: 3, label: "Defined and generally followed", description: "Documented and followed in normal conditions." },
  { value: 4, label: "Measured and controlled", description: "Performance is measured and deviations are acted on." },
  { value: 5, label: "Optimized and continuously improved", description: "Data-driven, stable, and continuously improved." },
];

/** Evidence strength values used by the Confidence Score. */
export const EVIDENCE_STRENGTH: Record<EvidenceType, number> = {
  none: 15,
  verbal: 25,
  document: 60,
  record_sampled: 80,
  direct_observation: 90,
  system_data: 100,
};

export const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  none: "No evidence provided",
  verbal: "Verbal statement only",
  document: "Document provided",
  record_sampled: "Record sampled and verified",
  direct_observation: "Direct observation",
  system_data: "System-generated or live data",
};

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  job_title: string | null;
  phone: string | null;
  status: EntityStatus;
}

export interface Organization {
  id: string;
  name: string;
  industry: string | null;
  headquarters: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  status: EntityStatus;
  created_at: string;
}

export interface Facility {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  primary_products: string | null;
  primary_processes: string | null;
  machine_count: number | null;
  employee_count: number | null;
  operating_shifts: number | null;
  certifications: string[] | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  status: EntityStatus;
  last_assessment_date: string | null;
  current_readiness_score: number | null;
}

export interface AssessmentCategory {
  id: string;
  template_version_id: string;
  code: string;
  name: string;
  description: string | null;
  /** Percentage of the overall score, 0-100. All categories must total 100. */
  weight: number;
  sort_order: number;
  archived: boolean;
}

export interface AssessmentQuestion {
  id: string;
  category_id: string;
  question_code: string;
  question_text: string;
  guidance_text: string | null;
  weight: number;
  is_critical: boolean;
  required_evidence: EvidenceType | null;
  sort_order: number;
  is_required: boolean;
  allow_not_applicable: boolean;
  /** Whether a failing score should auto-generate a finding recommendation. */
  auto_finding: boolean;
  default_severity: FindingSeverity;
  archived: boolean;
}


export interface AssessmentResponse {
  id: string;
  assessment_id: string;
  question_id: string;
  /** null means unanswered. Unanswered is NEVER treated as zero. */
  score: number | null;
  not_applicable: boolean;
  comments: string | null;
  evidence_type: EvidenceType;
  evidence_description: string | null;
}

export interface Assessment {
  id: string;
  organization_id: string;
  facility_id: string;
  template_version_id: string;
  name: string;
  assessment_type: string | null;
  assessment_date: string;
  lead_assessor: string | null;
  supporting_assessors: string[] | null;
  scope: string | null;
  production_area: string | null;
  product_family: string | null;
  notes: string | null;
  status: AssessmentStatus;
  overall_score: number | null;
  confidence_score: number | null;
  completion_pct: number | null;
  readiness_level: string | null;
  has_critical_failure: boolean;
  finalized_at: string | null;
}

export interface Finding {
  id: string;
  finding_code: string | null;
  organization_id: string;
  facility_id: string;
  assessment_id: string | null;
  question_id: string | null;
  category_name: string | null;
  severity: FindingSeverity;
  description: string;
  business_impact: string | null;
  root_cause: string | null;
  recommended_action: string | null;
  assigned_owner: string | null;
  target_date: string | null;
  status: FindingStatus;
  closure_evidence: string | null;
  verified_by: string | null;
  verification_date: string | null;
}

export interface CorrectiveAction {
  id: string;
  finding_id: string;
  facility_id: string;
  action_description: string;
  owner: string | null;
  target_date: string | null;
  completed_date: string | null;
  status: FindingStatus;
  verification_notes: string | null;
}

export interface ImprovementProject {
  id: string;
  organization_id: string;
  facility_id: string;
  name: string;
  owner: string | null;
  executive_sponsor: string | null;
  objective: string | null;
  baseline_metric: string | null;
  target_metric: string | null;
  estimated_financial_impact: number | null;
  planned_start: string | null;
  planned_completion: string | null;
  status: ProjectStatus;
  percent_complete: number;
  risks: string | null;
  actions: string | null;
  results: string | null;
}

export interface ReadinessHistoryPoint {
  id: string;
  facility_id: string;
  period_label: string;
  recorded_on: string;
  overall_score: number;
  confidence_score: number | null;
}

export interface AuditLogEntry {
  id: string;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface AssessmentTemplate {
  id: string;
  name: string;
  /** Human-readable template ID, e.g. IQ-MRA-001. */
  template_code: string | null;
  description: string | null;
  intended_use: string | null;
  industry: string | null;
  assessment_type: string | null;
  /** Set when a customer owns the template; null means IronIQ-owned. */
  owner_organization_id: string | null;
  status: TemplateStatus;
  archived: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssessmentTemplateVersion {
  id: string;
  template_id: string;
  version: number;
  status: TemplateStatus;
  published_at: string | null;
  published_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

