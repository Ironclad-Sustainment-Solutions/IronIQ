/**
 * Ironclad Field Capability Assessment — form catalog.
 *
 * Mirrors the printed "Production Capability Review" walkthrough: nine rated
 * observation sections, a client-stated problem block, capability gap capture,
 * top constraints, a rapid opportunity matrix and the field summary.
 *
 * Ratings are 1–5; "Not Observed" rows are excluded from the score denominator
 * and are never treated as zero.
 */

export const FIELD_SCALE = [
  {
    value: 5,
    label: "Controlled",
    description:
      "Standardized, documented, measurable, repeatable, consistently supports production.",
  },
  {
    value: 4,
    label: "Capable",
    description:
      "Generally supports production with minor weaknesses or isolated inconsistencies.",
  },
  {
    value: 3,
    label: "Functional",
    description:
      "Works, but depends on manual intervention, tribal knowledge or workarounds.",
  },
  {
    value: 2,
    label: "Constrained",
    description:
      "Regularly limits production, quality, cost, delivery or workforce performance.",
  },
  {
    value: 1,
    label: "Critical",
    description:
      "Missing, unreliable, severely degraded or creating major production risk.",
  },
] as const;

export interface FieldSection {
  code: string;
  number: number;
  title: string;
  question: string;
  areas: { code: string; label: string }[];
  keyQuestions: string[];
  lookFor?: string[];
}

const areas = (section: string, labels: string[]) =>
  labels.map((label) => ({
    code: `${section}.${label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")}`,
    label,
  }));

export const FIELD_SECTIONS: FieldSection[] = [
  {
    code: "production_operations",
    number: 3,
    title: "Production Operations",
    question:
      "Can the operation consistently execute the required production plan?",
    areas: areas("po", [
      "Production flow",
      "Machine utilization",
      "Work sequencing",
      "Bottleneck identification",
      "Work-in-process control",
      "Setup/changeover performance",
      "Cycle-time consistency",
      "Operator-to-machine balance",
      "Production scheduling",
      "Daily production visibility",
      "Constraint response",
      "Recovery from disruption",
    ]),
    keyQuestions: [
      "Where does production consistently slow down?",
      "Which machines or cells determine overall output?",
      "What prevents those machines from producing more?",
      "How much scheduled time is actually productive machining time?",
      "What causes the most unplanned interruptions?",
      "Are jobs waiting on machines, people, programs, tooling, fixtures, material, inspection or information?",
      "Are production targets based on demonstrated capability or historical expectations?",
    ],
  },
  {
    code: "tooling_fixturing",
    number: 4,
    title: "Tooling & Fixturing",
    question:
      "Does production have standardized and repeatable workholding and tooling support?",
    areas: areas("tf", [
      "Fixture availability",
      "Fixture standardization",
      "Fixture repeatability",
      "Fixture condition",
      "Setup documentation",
      "Tool availability",
      "Tool standardization",
      "Tool-life management",
      "Preset / offset management",
      "Tool crib / storage control",
    ]),
    keyQuestions: [
      "Are fixtures standardized between machines/cells?",
      "Are operators creating or modifying workholding at individual cells?",
      "How much setup knowledge exists only with individual employees?",
      "Are proven setups reused?",
      "Are fixture designs controlled and documented?",
      "Is tooling selected consistently?",
      "How often does production wait for tooling?",
      "Are inserts, holders, cutters and workholding standardized where practical?",
      "Is tool life measured or based primarily on operator judgment?",
    ],
  },
  {
    code: "programming_digital",
    number: 5,
    title: "CNC Programming & Digital Manufacturing",
    question:
      "Can digital manufacturing support production without becoming a constraint?",
    areas: areas("pd", [
      "Programming capacity",
      "Program standardization",
      "Program revision control",
      "CAM availability",
      "Machine/post compatibility",
      "Program transfer/control",
      "Setup sheet quality",
      "Proven-program reuse",
      "Digital file organization",
      "Programmer dependency",
    ]),
    keyQuestions: [
      "How many programmers support the facility?",
      "How many machines depend on those programmers?",
      "How long does a new program typically take?",
      "How are program revisions controlled?",
      "Can another programmer understand and modify an existing program?",
      "Are programs standardized between similar machines?",
      "Are setup sheets delivered with the program?",
      "Does production ever wait for programming?",
      "Are programs optimized after initial production?",
      "Is tribal programming knowledge creating risk?",
    ],
  },
  {
    code: "production_support",
    number: 6,
    title: "Production Support",
    question:
      "Does each production cell have what it needs before work reaches the machine?",
    areas: areas("ps", [
      "Setup planning",
      "Work instructions",
      "Material availability",
      "Tooling availability",
      "Fixture availability",
      "Program availability",
      "Inspection requirements",
      "Job traveler/router quality",
      "Pre-production readiness",
      "Engineering/technical support",
    ]),
    keyQuestions: [
      "What does an operator have to locate after a job reaches the machine?",
      "How often does production begin with missing information?",
      "Who resolves setup questions?",
      "Who resolves tooling or fixture issues?",
      "Are all requirements available before the scheduled production start?",
      "What routinely causes jobs to sit at the machine without producing?",
    ],
  },
  {
    code: "technical_data",
    number: 7,
    title: "Technical Data",
    question:
      "Can the organization clearly define how the product should be manufactured?",
    areas: areas("td", [
      "Drawing availability",
      "Drawing accuracy",
      "Revision control",
      "Specifications",
      "Process documentation",
      "Setup documentation",
      "BOM / routing accuracy",
      "Product history",
      "Data accessibility",
      "Document control",
    ]),
    keyQuestions: [],
    lookFor: [
      "Multiple drawing revisions in circulation",
      "Handwritten process information",
      "Operator notebooks",
      "Uncontrolled spreadsheets",
      "Missing setup documentation",
      "Missing fixture drawings",
      "Missing tooling documentation",
      "Programs without corresponding setup data",
      "Knowledge stored primarily with individuals",
      "Legacy paper-only information",
    ],
  },
  {
    code: "equipment_infrastructure",
    number: 8,
    title: "Equipment & Infrastructure",
    question:
      "Are machines and supporting systems capable of meeting production requirements?",
    areas: areas("ei", [
      "Machine availability",
      "Machine condition",
      "Preventive maintenance",
      "Breakdown response",
      "Machine capability",
      "Supporting equipment",
      "Material handling",
      "Utilities/infrastructure",
      "Layout effectiveness",
      "Maintenance data",
    ]),
    keyQuestions: [
      "Which machines cause the greatest production loss?",
      "Is downtime tracked by reason?",
      "Are repeat failures identified?",
      "Is preventive maintenance performed consistently?",
      "Are older machines being supported with sufficient technical information?",
      "Does layout create unnecessary movement or waiting?",
    ],
  },
  {
    code: "workforce_knowledge",
    number: 9,
    title: "Workforce & Knowledge",
    question:
      "Can the operation sustain capability independent of individual employees?",
    areas: areas("wk", [
      "Operator skill coverage",
      "Cross-training",
      "Programmer coverage",
      "Setup knowledge",
      "Troubleshooting capability",
      "Training documentation",
      "Standard work",
      "Knowledge retention",
      "Supervisor support",
      "Single-point dependencies",
    ]),
    keyQuestions: [
      "Which capabilities depend on one person, and what is the operational risk?",
    ],
  },
  {
    code: "quality_process",
    number: 10,
    title: "Quality & Process Control",
    question:
      "Is the process capable of consistently producing acceptable output?",
    areas: areas("qp", [
      "First-piece success",
      "In-process inspection",
      "Scrap visibility",
      "Rework visibility",
      "Process consistency",
      "Measurement capability",
      "Inspection planning",
      "Root-cause response",
      "Corrective action effectiveness",
      "Process-change control",
    ]),
    keyQuestions: [
      "Where is scrap being generated?",
      "Which operations produce recurring quality issues?",
      "Are defects connected to machines, tooling, fixtures, programs, material, process or operators?",
      "How much production capacity is consumed by rework?",
      "Are corrective actions permanently changing the process?",
    ],
  },
  {
    code: "performance_visibility",
    number: 11,
    title: "Performance Data & Visibility",
    question:
      "Does management have enough information to understand actual production capability?",
    areas: areas("pv", [
      "Production output tracking",
      "Downtime tracking",
      "Scrap/rework tracking",
      "Cycle-time tracking",
      "Setup-time tracking",
      "Machine utilization",
      "Schedule attainment",
      "Labor performance",
      "Constraint visibility",
      "Management reporting",
    ]),
    keyQuestions: [
      "What was planned?",
      "What was actually produced?",
      "What prevented the difference?",
      "Where was capacity lost?",
      "What is the current primary constraint?",
      "Is that constraint getting better or worse?",
    ],
  },
];

export const ALL_AREA_CODES = FIELD_SECTIONS.flatMap((s) =>
  s.areas.map((a) => a.code),
);

export const IMPACT_OPTIONS = [
  "Lost production",
  "Machine downtime",
  "Long setup/changeover",
  "Scrap or rework",
  "Quality variation",
  "Missed delivery",
  "Excess labor",
  "Programming delays",
  "Tooling constraints",
  "Fixture constraints",
  "Maintenance issues",
  "Workforce dependency",
  "Missing/inaccurate data",
  "Scheduling problems",
];

export const GAP_IMPACT_OPTIONS = [
  "Throughput",
  "Downtime",
  "Quality",
  "Cost",
  "Delivery",
  "Labor",
  "Setup",
  "Programming",
  "Tooling",
  "Fixture",
  "Data",
  "Workforce",
];

export const SEVERITY_OPTIONS = ["Critical", "High", "Moderate", "Low"];
export const FREQUENCY_OPTIONS = [
  "Continuous",
  "Daily",
  "Weekly",
  "Intermittent",
  "One-time",
];

export const ROOT_CAPABILITY_OPTIONS = [
  "Technical Data",
  "Digital Manufacturing",
  "Production Support",
  "Production Operations",
  "Equipment & Infrastructure",
  "Workforce & Knowledge",
  "Quality / Process Control",
  "Performance Visibility",
];

export const WORKSTREAM_OPTIONS = [
  "Production bottleneck analysis",
  "Production remapping",
  "Fixture standardization / development",
  "CNC programming support",
  "CNC program optimization",
  "Tooling standardization",
  "Setup reduction",
  "Digital manufacturing package development",
  "Technical data recovery",
  "Work instruction development",
  "Process documentation",
  "Production readiness improvement",
  "Performance-data structure",
  "Knowledge capture / standardization",
  "Operational capability improvement",
];

export const LEVEL_OPTIONS = ["High", "Medium", "Low"];

export const PRIORITY_OPTIONS = [
  "Immediate Stabilization",
  "Capability Restoration",
  "Capability Strengthening",
  "Sustainment",
];

export const PRIORITY_HELP: Record<string, string> = {
  "Immediate Stabilization":
    "Actions required to stop ongoing production loss.",
  "Capability Restoration":
    "Rebuild a capability that is currently missing, degraded or unreliable.",
  "Capability Strengthening":
    "Improve an existing capability so it becomes repeatable, scalable and measurable.",
  Sustainment:
    "Standardize, document, measure and preserve the restored capability.",
};

export interface FieldObservationRow {
  id: string;
  field_assessment_id: string;
  section_code: string;
  area_code: string;
  rating: number | null;
  not_observed: boolean;
  notes: string | null;
}

export interface FieldGapRow {
  id: string;
  field_assessment_id: string;
  gap_number: number | null;
  location: string | null;
  observed_condition: string | null;
  objective_evidence: string | null;
  missing_capability: string | null;
  impact_tags: string[];
  severity: string | null;
  frequency: string | null;
  root_capability: string | null;
  current_state: string | null;
  capability_needed: string | null;
  ironclad_action: string | null;
  expected_result: string | null;
  sort_order: number;
}

export interface FieldConstraintRow {
  id: string;
  field_assessment_id: string;
  rank: number;
  capability_gap: string | null;
  evidence: string | null;
  production_impact: string | null;
  ironclad_response: string | null;
}

export interface FieldOpportunityRow {
  id: string;
  field_assessment_id: string;
  opportunity: string | null;
  impact: string | null;
  effort: string | null;
  priority: string | null;
  sort_order: number;
}

export interface SectionResult {
  score: number | null;
  rated: number;
  total: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function sectionResult(
  section: FieldSection,
  rows: FieldObservationRow[],
): SectionResult {
  const byArea = new Map(rows.map((r) => [r.area_code, r]));
  const values: number[] = [];
  for (const a of section.areas) {
    const row = byArea.get(a.code);
    if (!row || row.not_observed || typeof row.rating !== "number") continue;
    values.push(row.rating);
  }
  return {
    score: values.length
      ? round1(values.reduce((x, y) => x + y, 0) / values.length)
      : null,
    rated: values.length,
    total: section.areas.length,
  };
}

export interface FieldReviewResult {
  score: number | null;
  percent: number | null;
  rated: number;
  total: number;
  criticalCount: number;
  constrainedCount: number;
  completionPct: number;
}

export function computeReviewScore(
  rows: FieldObservationRow[],
): FieldReviewResult {
  const byArea = new Map(rows.map((r) => [r.area_code, r]));
  const values: number[] = [];
  let criticalCount = 0;
  let constrainedCount = 0;
  let applicable = 0;

  for (const code of ALL_AREA_CODES) {
    const row = byArea.get(code);
    if (row?.not_observed) continue;
    applicable += 1;
    if (!row || typeof row.rating !== "number") continue;
    values.push(row.rating);
    if (row.rating <= 1) criticalCount += 1;
    else if (row.rating === 2) constrainedCount += 1;
  }

  const score = values.length
    ? round1(values.reduce((x, y) => x + y, 0) / values.length)
    : null;
  return {
    score,
    percent: score === null ? null : round1((score / 5) * 100),
    rated: values.length,
    total: ALL_AREA_CODES.length,
    criticalCount,
    constrainedCount,
    completionPct:
      applicable === 0 ? 100 : round1((values.length / applicable) * 100),
  };
}
