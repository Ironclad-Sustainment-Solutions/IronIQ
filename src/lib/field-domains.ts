/**
 * Ironclad Field Capability Assessment — domain catalog and preliminary
 * baseline maths.
 *
 * A field assessment is a rapid walkthrough. Ratings recorded here are
 * PRELIMINARY FIELD RATINGS: they are never presented as a complete
 * organizational capability score, and every domain carries an observation
 * coverage figure plus a confidence label so limited evidence can never imply
 * a finished assessment.
 */

export interface FieldDomain {
  code: string;
  number: number;
  title: string;
  question: string;
  categories: string[];
}

export const FIELD_DOMAINS: FieldDomain[] = [
  {
    code: "production_operations",
    number: 1,
    title: "Production Operations",
    question:
      "Can the operation consistently execute the required production plan?",
    categories: [
      "Production Flow",
      "Machine Utilization",
      "Production Bottlenecks",
      "Work Sequencing",
      "Work-In-Process",
      "Setup / Changeover",
      "Cycle-Time Consistency",
      "Operator-to-Machine Balance",
      "Production Scheduling",
      "Production Visibility",
      "Constraint Management",
      "Recovery From Disruption",
    ],
  },
  {
    code: "tooling_fixturing",
    number: 2,
    title: "Tooling & Fixturing",
    question:
      "Does production have standardized, repeatable tooling and workholding support?",
    categories: [
      "Fixture Availability",
      "Fixture Standardization",
      "Fixture Repeatability",
      "Fixture Condition",
      "Fixture Documentation",
      "Setup Documentation",
      "Tool Availability",
      "Tool Standardization",
      "Tool-Life Management",
      "Tool Storage / Control",
      "Offset Management",
    ],
  },
  {
    code: "digital_manufacturing",
    number: 3,
    title: "Digital Manufacturing / CNC Programming",
    question:
      "Can digital manufacturing support production without becoming a constraint?",
    categories: [
      "Programming Capacity",
      "Program Standardization",
      "CAM Capability",
      "Program Revision Control",
      "Machine/Post Compatibility",
      "Program Transfer",
      "Setup Sheets",
      "Proven Program Reuse",
      "Program Optimization",
      "Digital File Organization",
      "Programmer Dependency",
    ],
  },
  {
    code: "production_support",
    number: 4,
    title: "Production Support",
    question:
      "Does production have everything required before work reaches the machine?",
    categories: [
      "Setup Planning",
      "Tooling Availability",
      "Fixture Availability",
      "Program Availability",
      "Material Availability",
      "Inspection Requirements",
      "Work Instructions",
      "Production Routing",
      "Pre-Production Readiness",
      "Technical Support",
    ],
  },
  {
    code: "technical_data",
    number: 5,
    title: "Technical Data",
    question:
      "Can the organization clearly define what needs to be manufactured and how?",
    categories: [
      "Engineering Drawings",
      "Specifications",
      "Bills of Material",
      "Revision Control",
      "Process Documentation",
      "Setup Documentation",
      "Fixture Documentation",
      "Product History",
      "Data Accessibility",
      "Document Control",
    ],
  },
  {
    code: "equipment_infrastructure",
    number: 6,
    title: "Equipment & Infrastructure",
    question:
      "Are machines and supporting systems capable of meeting production requirements?",
    categories: [
      "Machine Availability",
      "Machine Condition",
      "Machine Capability",
      "Preventive Maintenance",
      "Breakdown Response",
      "Supporting Equipment",
      "Material Handling",
      "Plant Layout",
      "Utilities",
      "Maintenance Data",
    ],
  },
  {
    code: "workforce_knowledge",
    number: 7,
    title: "Workforce & Knowledge",
    question:
      "Can the organization sustain capability without relying excessively on individual employees?",
    categories: [
      "Operator Skill Coverage",
      "Cross-Training",
      "Programming Coverage",
      "Setup Knowledge",
      "Troubleshooting Knowledge",
      "Training Documentation",
      "Standard Work",
      "Knowledge Retention",
      "Supervisor Support",
      "Single-Point Dependencies",
    ],
  },
  {
    code: "performance_data",
    number: 8,
    title: "Performance Data & Process Control",
    question:
      "Can the organization see, measure, and control actual production performance?",
    categories: [
      "Production Output",
      "Downtime",
      "Cycle Time",
      "Setup Time",
      "Machine Utilization",
      "Schedule Attainment",
      "Scrap",
      "Rework",
      "Quality Performance",
      "Labor Performance",
      "Constraint Visibility",
      "Management Reporting",
    ],
  },
];

export const domainByCode = (code: string | null | undefined) =>
  FIELD_DOMAINS.find((d) => d.code === code) ?? null;

export const domainTitle = (code: string | null | undefined) =>
  domainByCode(code)?.title ?? "Unassigned";

/* ---------------------------- option catalogs ---------------------------- */

export const ASSESSMENT_STATUSES = [
  "Draft",
  "In Progress",
  "Field Review Complete",
  "Report Generated",
  "Converted to Full Assessment",
];

export const EVIDENCE_CLASSES = [
  "Observed",
  "Reported",
  "Inferred",
  "Requires Validation",
];

export const PROBLEM_IMPACT_OPTIONS = [
  "Production Output",
  "Machine Downtime",
  "Quality",
  "Scrap",
  "Rework",
  "Cost",
  "Delivery",
  "Labor",
  "Setup Time",
  "Programming",
  "Tooling",
  "Fixtures",
  "Maintenance",
  "Scheduling",
  "Workforce",
  "Technical Data",
  "Other",
];

export const PRODUCTION_IMPACT_OPTIONS = [
  "Throughput",
  "Machine Downtime",
  "Quality",
  "Scrap",
  "Rework",
  "Cost",
  "Delivery",
  "Labor",
  "Setup Time",
  "Programming",
  "Tooling",
  "Fixtures",
  "Maintenance",
  "Technical Data",
  "Workforce",
  "Scheduling",
  "Other",
];

export const GAP_SEVERITY = ["Critical", "High", "Moderate", "Low"];
export const GAP_FREQUENCY = [
  "Continuous",
  "Daily",
  "Weekly",
  "Intermittent",
  "One-Time",
  "Unknown",
];
export const ASSESSOR_CONFIDENCE = [
  "High Confidence",
  "Moderate Confidence",
  "Requires Validation",
];

export const ROOT_CAPABILITY_DOMAINS = [
  "Technical Data",
  "Digital Manufacturing",
  "Production Support",
  "Production Operations",
  "Equipment & Infrastructure",
  "Workforce & Knowledge",
  "Performance Data / Process Control",
];

export const IRONCLAD_ACTIONS = [
  "Production Bottleneck Analysis",
  "Production Flow Mapping",
  "Production Remapping",
  "Fixture Design",
  "Fixture Standardization",
  "Fixture Documentation",
  "CNC Programming Support",
  "CNC Program Optimization",
  "CAM Development",
  "Setup Sheet Development",
  "Tooling Standardization",
  "Setup Reduction",
  "Digital Manufacturing Package Development",
  "Technical Data Recovery",
  "Work Instruction Development",
  "Process Documentation",
  "Production Readiness Improvement",
  "Operational Capability Improvement",
  "Performance Data Structure",
  "Knowledge Capture",
  "Standard Work Development",
  "Other",
];

export const IMPACT_LEVELS = ["High", "Medium", "Low"];
export const URGENCY_LEVELS = ["Immediate", "Near-Term", "Long-Term"];
export const IRONCLAD_FIT = [
  "Strong",
  "Moderate",
  "Outside Current Scope",
  "Requires Partner",
  "Requires Further Assessment",
];
export const PRIORITY_CODES = [
  "P1 — Immediate",
  "P2 — High",
  "P3 — Moderate",
  "P4 — Future",
];
export const PRIORITY_CLASSES = [
  "Immediate Stabilization",
  "Capability Restoration",
  "Capability Strengthening",
  "Sustainment",
];

export const PRIORITY_CLASS_HELP: Record<string, string> = {
  "Immediate Stabilization":
    "Something currently causing active production loss.",
  "Capability Restoration":
    "A missing, degraded or unreliable capability needs to be rebuilt.",
  "Capability Strengthening":
    "The capability exists but needs greater standardization, consistency, capacity or control.",
  Sustainment:
    "The capability needs documentation, measurement, knowledge preservation or ongoing control.",
};

/** Field assessment focus-area list — customer scoped, never applied globally. */
export const FIELD_FOCUS_AREAS = [
  "Production Flow",
  "Machine Utilization",
  "Production Bottlenecks",
  "Fixture Standardization",
  "Fixture Availability",
  "Setup / Changeover",
  "Programming Capacity",
  "Program Standardization",
  "Tool Standardization",
  "Pre-Production Readiness",
  "Work Instructions",
  "Process Documentation",
  "Downtime",
  "Cycle Time",
  "Scrap",
  "Rework",
  "Production Scheduling",
  "Single-Point Dependencies",
  "Production Output",
];

/* ------------------------------- row types ------------------------------- */

export interface FieldCaptureObservationRow {
  id: string;
  field_assessment_id: string;
  domain_code: string;
  category: string | null;
  area: string | null;
  machine: string | null;
  production_cell: string | null;
  process: string | null;
  observed_condition: string | null;
  objective_evidence: string | null;
  assessor_notes: string | null;
  context_source: string | null;
  rating: number | null;
  not_observed: boolean;
  evidence_class: string;
  created_at: string;
  /** One of the 12 field overview areas (field-followup.ts). */
  focus_area: string | null;
  operational_impact: string | null;
  constrained_capability: string | null;
  severity: string | null;
  ironclad_support: string | null;
  requires_validation: boolean;
}

export interface FieldQuickCaptureRow {
  id: string;
  field_assessment_id: string;
  note: string | null;
  area: string | null;
  machine: string | null;
  domain_code: string | null;
  potential_problem: string | null;
  converted_observation_id: string | null;
  created_at: string;
}

export interface FieldAttachmentRow {
  id: string;
  field_assessment_id: string;
  observation_id: string | null;
  gap_id: string | null;
  storage_path: string;
  file_name: string | null;
  caption: string | null;
  area: string | null;
  machine: string | null;
  domain_code: string | null;
  created_at: string;
}

/** Extended capability gap — the field assessment's central finding record. */
export interface FieldCapabilityGap {
  id: string;
  field_assessment_id: string;
  gap_number: number | null;
  title: string | null;
  domain_code: string | null;
  category: string | null;
  observation_id: string | null;
  location: string | null;
  observed_condition: string | null;
  objective_evidence: string | null;
  missing_capability: string | null;
  impact_tags: string[];
  severity: string | null;
  frequency: string | null;
  root_capability: string | null;
  evidence_class: string | null;
  confidence: string | null;
  current_state: string | null;
  capability_needed: string | null;
  ironclad_action: string | null;
  ironclad_actions: string[];
  expected_result: string | null;
  operational_impact: string | null;
  implementation_effort: string | null;
  urgency: string | null;
  ironclad_fit: string | null;
  priority_code: string | null;
  priority_class: string | null;
  is_top_finding: boolean;
  field_rating: number | null;
  sort_order: number;
  /** One of the 12 field overview areas (field-followup.ts). */
  focus_area: string | null;
  operational_impact_text: string | null;
  preliminary_constraint: string | null;
  validation_needed: string | null;
  ironclad_support: string | null;
  validation_questions: string[];
  data_requirements: string[];
  client_status: string | null;
  client_comments: string | null;
  finding_rank: number | null;
  opp_service: string | null;
  opp_scope: string | null;
  opp_complexity: string | null;
  opp_revenue: string | null;
  opp_resources: string | null;
  opp_partner: string | null;
  opp_confidence: string | null;
  opp_stage: string | null;
  opp_next_action: string | null;
}

/* ------------------------------ baseline maths ---------------------------- */

const round1 = (n: number) => Math.round(n * 10) / 10;

export type BaselineBand = "green" | "yellow" | "orange" | "red" | "gray";

export const BAND_LABEL: Record<BaselineBand, string> = {
  green: "Generally capable",
  yellow: "Functional but inconsistent",
  orange: "Constrained",
  red: "Critical",
  gray: "Insufficient evidence",
};

export const BAND_BG: Record<BaselineBand, string> = {
  green: "bg-success",
  yellow: "bg-medium",
  orange: "bg-high",
  red: "bg-critical",
  gray: "bg-steel",
};

export const BAND_TEXT: Record<BaselineBand, string> = {
  green: "text-success",
  yellow: "text-medium",
  orange: "text-high",
  red: "text-critical",
  gray: "text-muted-foreground",
};

export function ratingBand(score: number | null): BaselineBand {
  if (score === null) return "gray";
  if (score >= 4.5) return "green";
  if (score >= 3.5) return "yellow";
  if (score >= 2.5) return "orange";
  return "red";
}

export interface DomainBaseline {
  domain: FieldDomain;
  observations: number;
  ratedObservations: number;
  averageRating: number | null;
  criticalGaps: number;
  highPriorityGaps: number;
  coveragePct: number;
  confidence: "High" | "Moderate" | "Low" | "Requires Full Assessment";
  band: BaselineBand;
}

/**
 * Coverage is the share of a domain's observation categories that carry at
 * least one recorded observation. Confidence is derived from coverage — it is
 * deliberately conservative so a short walk never reads as a full assessment.
 */
export function domainBaseline(
  domain: FieldDomain,
  observations: FieldCaptureObservationRow[],
  gaps: FieldCapabilityGap[],
): DomainBaseline {
  const rows = observations.filter((o) => o.domain_code === domain.code);
  const rated = rows.filter(
    (o) => !o.not_observed && typeof o.rating === "number",
  );
  const average = rated.length
    ? round1(
        rated.reduce((sum, o) => sum + (o.rating as number), 0) / rated.length,
      )
    : null;

  const covered = new Set(
    rows
      .map((o) => o.category)
      .filter((c): c is string => Boolean(c && domain.categories.includes(c))),
  );
  const coveragePct = Math.round(
    (covered.size / domain.categories.length) * 100,
  );

  const domainGaps = gaps.filter((g) => g.domain_code === domain.code);
  const criticalGaps = domainGaps.filter(
    (g) => g.severity === "Critical",
  ).length;
  const highPriorityGaps = domainGaps.filter(
    (g) =>
      g.severity === "High" ||
      g.priority_code?.startsWith("P1") ||
      g.priority_code?.startsWith("P2"),
  ).length;

  const confidence: DomainBaseline["confidence"] =
    coveragePct >= 70
      ? "High"
      : coveragePct >= 40
        ? "Moderate"
        : coveragePct > 0
          ? "Low"
          : "Requires Full Assessment";

  return {
    domain,
    observations: rows.length,
    ratedObservations: rated.length,
    averageRating: average,
    criticalGaps,
    highPriorityGaps,
    coveragePct,
    confidence,
    band: rows.length === 0 ? "gray" : ratingBand(average),
  };
}

export interface FieldBaseline {
  domains: DomainBaseline[];
  overallRating: number | null;
  overallCoveragePct: number;
  domainsObserved: number;
  totalObservations: number;
}

export function fieldBaseline(
  observations: FieldCaptureObservationRow[],
  gaps: FieldCapabilityGap[],
): FieldBaseline {
  const domains = FIELD_DOMAINS.map((d) =>
    domainBaseline(d, observations, gaps),
  );
  const rated = observations.filter(
    (o) => !o.not_observed && typeof o.rating === "number",
  );
  return {
    domains,
    overallRating: rated.length
      ? round1(
          rated.reduce((s, o) => s + (o.rating as number), 0) / rated.length,
        )
      : null,
    overallCoveragePct: Math.round(
      domains.reduce((s, d) => s + d.coveragePct, 0) / (domains.length || 1),
    ),
    domainsObserved: domains.filter((d) => d.observations > 0).length,
    totalObservations: observations.length,
  };
}

/** Suggested priority code from impact + effort + urgency. Assessor may override. */
export function suggestedPriority(gap: FieldCapabilityGap): string {
  if (gap.severity === "Critical" || gap.urgency === "Immediate")
    return "P1 — Immediate";
  if (gap.operational_impact === "High") return "P2 — High";
  if (gap.operational_impact === "Medium") return "P3 — Moderate";
  return "P4 — Future";
}

export const DEFAULT_CONCLUSION = `The Field Capability Assessment identified several areas where existing manufacturing resources may not be supported by the operational capabilities required to consistently achieve desired production performance.

Observed constraints should be validated through a full IronIQ Capability Assessment to determine root causes, quantify operational impact, establish measurable baselines, and develop a prioritized capability restoration plan.`;
