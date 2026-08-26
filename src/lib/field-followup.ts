/**
 * Field Capability Assessment → Findings Review meeting flow.
 *
 * The field visit is a rapid operational overview, never a full assessment.
 * Everything here keeps that distinction visible: qualitative statuses instead
 * of scores, explicit evidence classification, and an honest recommendation of
 * whether a deeper Full Capability Assessment is actually warranted.
 */

import type {
  FieldCapabilityGap,
  FieldCaptureObservationRow,
} from "./field-domains";

/* ------------------------- 12 field overview areas ------------------------ */

export interface FieldArea {
  code: string;
  number: number;
  title: string;
  /** What the assessor is looking for during the walkthrough. */
  prompt: string;
  /** Parent capability domain used for the full assessment handoff. */
  domain_code: string;
}

export const FIELD_AREAS: FieldArea[] = [
  {
    code: "production_flow",
    number: 1,
    title: "Production Flow",
    prompt:
      "Does work move through the area without waiting, detours or rework loops?",
    domain_code: "production_operations",
  },
  {
    code: "machine_cell_performance",
    number: 2,
    title: "Machine / Cell Performance",
    prompt:
      "Are machines and cells running when they should, at the expected rate?",
    domain_code: "equipment_infrastructure",
  },
  {
    code: "fixtures_workholding",
    number: 3,
    title: "Fixtures & Workholding",
    prompt:
      "Is workholding available, repeatable, documented and in usable condition?",
    domain_code: "tooling_fixturing",
  },
  {
    code: "tooling",
    number: 4,
    title: "Tooling",
    prompt:
      "Is the right tooling available, standardized and controlled at the machine?",
    domain_code: "tooling_fixturing",
  },
  {
    code: "setup_changeover",
    number: 5,
    title: "Setup & Changeover",
    prompt:
      "Are setups repeatable, documented and completed without rediscovery?",
    domain_code: "production_operations",
  },
  {
    code: "cnc_programming",
    number: 6,
    title: "CNC Programming",
    prompt:
      "Can programming keep pace with production without becoming the constraint?",
    domain_code: "digital_manufacturing",
  },
  {
    code: "production_support",
    number: 7,
    title: "Production Support",
    prompt: "Is everything required at the machine before the job arrives?",
    domain_code: "production_support",
  },
  {
    code: "technical_documentation",
    number: 8,
    title: "Technical Documentation",
    prompt:
      "Are drawings, specs and process documents current, complete and accessible?",
    domain_code: "technical_data",
  },
  {
    code: "equipment_support",
    number: 9,
    title: "Equipment Support",
    prompt:
      "Is maintenance keeping equipment available and capable for this work?",
    domain_code: "equipment_infrastructure",
  },
  {
    code: "workforce_knowledge",
    number: 10,
    title: "Workforce & Knowledge",
    prompt: "Can more than one person run this work to the required standard?",
    domain_code: "workforce_knowledge",
  },
  {
    code: "quality_process_control",
    number: 11,
    title: "Quality & Process Control",
    prompt: "Is the process controlled, or is quality caught after the fact?",
    domain_code: "performance_data",
  },
  {
    code: "performance_data",
    number: 12,
    title: "Performance Data",
    prompt: "Can the organization see actual output, downtime and constraints?",
    domain_code: "performance_data",
  },
];

export const areaByCode = (code: string | null | undefined) =>
  FIELD_AREAS.find((a) => a.code === code) ?? null;

export const areaTitle = (code: string | null | undefined) =>
  areaByCode(code)?.title ?? "Unassigned area";

/* --------------------------- qualitative statuses ------------------------- */

export const FIELD_STATUSES = [
  "Generally Capable",
  "Opportunity Identified",
  "Constrained",
  "Requires Assessment",
] as const;

export type FieldStatus = (typeof FIELD_STATUSES)[number];

export const STATUS_TEXT: Record<FieldStatus, string> = {
  "Generally Capable": "text-success",
  "Opportunity Identified": "text-medium",
  Constrained: "text-critical",
  "Requires Assessment": "text-muted-foreground",
};

export const STATUS_BG: Record<FieldStatus, string> = {
  "Generally Capable": "bg-success",
  "Opportunity Identified": "bg-medium",
  Constrained: "bg-critical",
  "Requires Assessment": "bg-steel",
};

export const STATUS_HELP: Record<FieldStatus, string> = {
  "Generally Capable":
    "Nothing observed that appears to limit production in this area.",
  "Opportunity Identified":
    "Working today, but an improvement opportunity was visible.",
  Constrained:
    "Something observed appears to actively limit production capability.",
  "Requires Assessment":
    "Not enough was seen during the walkthrough to form a view.",
};

/**
 * Suggested status for an area from what was actually recorded. Never a score:
 * a walkthrough cannot support one. The assessor may override any status.
 */
export function suggestAreaStatus(
  area: FieldArea,
  observations: FieldCaptureObservationRow[],
  gaps: FieldCapabilityGap[],
): FieldStatus {
  const rows = observations.filter((o) => o.focus_area === area.code);
  const areaGaps = gaps.filter((g) => g.focus_area === area.code);
  if (rows.length === 0 && areaGaps.length === 0) return "Requires Assessment";

  const constrained =
    areaGaps.some((g) => g.severity === "Critical" || g.severity === "High") ||
    rows.some((o) => o.severity === "Critical" || o.severity === "High") ||
    rows.some(
      (o) =>
        typeof o.rating === "number" &&
        !o.not_observed &&
        (o.rating as number) <= 2,
    );
  if (constrained) return "Constrained";

  if (areaGaps.length > 0 || rows.some((o) => o.severity === "Moderate"))
    return "Opportunity Identified";

  const observed = rows.filter((o) => !o.not_observed);
  return observed.length > 0 ? "Generally Capable" : "Requires Assessment";
}

export interface AreaBaseline {
  area: FieldArea;
  status: FieldStatus;
  suggested: FieldStatus;
  overridden: boolean;
  observations: number;
  gaps: number;
  requiresValidation: number;
}

export function areaBaselines(
  observations: FieldCaptureObservationRow[],
  gaps: FieldCapabilityGap[],
  overrides: Record<string, string> = {},
): AreaBaseline[] {
  return FIELD_AREAS.map((area) => {
    const suggested = suggestAreaStatus(area, observations, gaps);
    const raw = overrides[area.code];
    const status = (FIELD_STATUSES as readonly string[]).includes(raw ?? "")
      ? (raw as FieldStatus)
      : suggested;
    const rows = observations.filter((o) => o.focus_area === area.code);
    return {
      area,
      status,
      suggested,
      overridden: Boolean(raw) && raw !== suggested,
      observations: rows.length,
      gaps: gaps.filter((g) => g.focus_area === area.code).length,
      requiresValidation: rows.filter(
        (o) =>
          o.requires_validation || o.evidence_class === "Requires Validation",
      ).length,
    };
  });
}

/* ------------------------------- observations ----------------------------- */

export const OBSERVATION_SEVERITY = ["Critical", "High", "Moderate", "Low"];

export const OPERATIONAL_IMPACT_HINTS = [
  "Throughput",
  "Machine availability",
  "Setup time",
  "Scrap / rework",
  "Delivery",
  "Labor",
  "Quality",
  "Cost",
];

/* ------------------------- client validation states ----------------------- */

export const CLIENT_VALIDATION_STATES = [
  "Confirmed",
  "Partially Accurate",
  "Needs Context",
  "Disputed",
  "Already Being Addressed",
] as const;

export const CLIENT_STATE_TEXT: Record<string, string> = {
  Confirmed: "text-success",
  "Partially Accurate": "text-medium",
  "Needs Context": "text-medium",
  Disputed: "text-critical",
  "Already Being Addressed": "text-muted-foreground",
};

/* ---------------------- internal opportunity catalogs --------------------- */

export const OPP_SERVICES = [
  "Fixture Design & Standardization",
  "Tooling Standardization",
  "CNC Programming Support",
  "CAM Development",
  "Setup Reduction",
  "Digital Manufacturing Package",
  "Technical Data Recovery",
  "Work Instruction Development",
  "Production Flow Remapping",
  "Production Bottleneck Analysis",
  "Manufacturing Data Collection Improvement",
  "Performance Data Structure",
  "Knowledge Capture",
  "Operational Capability Improvement",
  "Full Capability Assessment",
];

export const OPP_COMPLEXITY = ["Low", "Moderate", "High"];
export const OPP_REVENUE = ["Small", "Medium", "Large", "Unknown"];
export const OPP_CONFIDENCE = ["High", "Moderate", "Low"];
export const OPP_STAGES = [
  "Identified",
  "Qualifying",
  "Proposal Drafting",
  "Proposed",
  "Won",
  "Not Pursued",
];

/* ---------------------------- next-path decision -------------------------- */

export const NEXT_PATHS = [
  "Targeted Restoration Project",
  "Full Capability Assessment",
  "No Further Engagement",
] as const;

export interface PathAnswers {
  significantConstraints: boolean | null;
  measurableImpact: boolean | null;
  unvalidated: boolean | null;
  deeperHelps: boolean | null;
  inScope: boolean | null;
}

export const PATH_QUESTIONS: {
  key: keyof PathAnswers;
  column: string;
  label: string;
}[] = [
  {
    key: "significantConstraints",
    column: "rec_significant_constraints",
    label: "Were significant capability constraints observed?",
  },
  {
    key: "measurableImpact",
    column: "rec_measurable_impact",
    label:
      "Do those constraints appear to affect measurable production performance?",
  },
  {
    key: "unvalidated",
    column: "rec_unvalidated",
    label: "Are the underlying causes still unvalidated?",
  },
  {
    key: "deeperHelps",
    column: "rec_deeper_helps",
    label:
      "Would deeper investigation materially improve the client's decisions?",
  },
  {
    key: "inScope",
    column: "rec_in_scope",
    label: "Is the work within Ironclad's scope of support?",
  },
];

export interface PathRecommendation {
  path: (typeof NEXT_PATHS)[number] | null;
  rationale: string;
  answered: number;
}

export function recommendPath(a: PathAnswers): PathRecommendation {
  const answered = Object.values(a).filter((v) => v !== null).length;

  if (a.significantConstraints === false && a.measurableImpact === false) {
    return {
      path: "No Further Engagement",
      rationale:
        "No significant constraints with production impact were observed. Recommend documenting the visit and remaining available if conditions change.",
      answered,
    };
  }
  if (a.inScope === false) {
    return {
      path: "No Further Engagement",
      rationale:
        "The observed constraints fall outside Ironclad's scope of support. Recommend referring the client to an appropriate partner.",
      answered,
    };
  }
  if (a.significantConstraints && a.unvalidated && a.deeperHelps) {
    return {
      path: "Full Capability Assessment",
      rationale:
        "Constraints appear significant but their root causes are unvalidated. A Full Capability Assessment is needed to confirm cause, quantify impact and build a restoration plan.",
      answered,
    };
  }
  if (a.significantConstraints && a.unvalidated === false) {
    return {
      path: "Targeted Restoration Project",
      rationale:
        "The constraint and its cause are already clear enough to act on. A targeted restoration project can proceed without a full assessment.",
      answered,
    };
  }
  if (answered === 0)
    return {
      path: null,
      rationale: "Answer the questions to see a recommendation.",
      answered,
    };
  return {
    path: null,
    rationale:
      "Answer the remaining questions — the recorded evidence does not yet point to one path.",
    answered,
  };
}

/* --------------------------- meeting agenda script ------------------------ */

export const MEETING_AGENDA = [
  {
    minutes: 5,
    title: "Purpose of the visit",
    detail: "Why Ironclad was onsite and what was in scope.",
  },
  {
    minutes: 5,
    title: "What we were asked to look at",
    detail: "The client-stated problem in their words.",
  },
  {
    minutes: 10,
    title: "What we observed",
    detail: "Field overview by area, with evidence classification.",
  },
  {
    minutes: 20,
    title: "Preliminary findings",
    detail: "Top findings, one at a time, with client validation.",
  },
  {
    minutes: 10,
    title: "What is still unknown",
    detail: "What could not be validated during a short walk.",
  },
  {
    minutes: 5,
    title: "What we would need to learn next",
    detail: "Data, access and interviews required.",
  },
  {
    minutes: 5,
    title: "Recommended next step",
    detail: "Targeted project, full assessment, or no engagement.",
  },
];

/* ---------------------------- client summary text ------------------------- */

export interface SummaryInputs {
  clientName: string | null;
  facility: string | null;
  date: string | null;
  assessors: string | null;
  problem: string | null;
  areas: AreaBaseline[];
  findings: FieldCapabilityGap[];
  unknowns: string[];
  recommendation: string | null;
  rationale: string | null;
}

/** Deterministic client-facing summary. AI drafting is optional on top of it. */
export function buildClientSummary(i: SummaryInputs): string {
  const lines: string[] = [];
  lines.push(`IRONCLAD FIELD CAPABILITY SUMMARY`);
  lines.push([i.clientName, i.facility, i.date].filter(Boolean).join(" · "));
  if (i.assessors) lines.push(`Ironclad assessors: ${i.assessors}`);
  lines.push("");
  lines.push("1. PURPOSE OF THE VISIT");
  lines.push(
    "Ironclad conducted a rapid onsite field capability review to understand the operational conditions surrounding the problem raised by the client. This was a limited walkthrough, not a full capability assessment.",
  );
  lines.push("");
  lines.push("2. WHAT THE CLIENT ASKED US TO LOOK AT");
  lines.push(i.problem || "—");
  lines.push("");
  lines.push("3. WHAT WE OBSERVED");
  for (const a of i.areas) lines.push(`• ${a.area.title} — ${a.status}`);
  lines.push("");
  lines.push("4. PRELIMINARY FINDINGS");
  if (i.findings.length === 0) {
    lines.push("No findings have been selected yet.");
  } else {
    i.findings.forEach((f, n) => {
      lines.push(
        `Finding ${n + 1}: ${f.title || f.observed_condition || "Untitled finding"}`,
      );
      if (f.observed_condition)
        lines.push(`  Observed: ${f.observed_condition}`);
      if (f.operational_impact_text)
        lines.push(`  Operational impact: ${f.operational_impact_text}`);
      if (f.preliminary_constraint)
        lines.push(`  Preliminary constraint: ${f.preliminary_constraint}`);
      if (f.validation_needed)
        lines.push(`  Validation required: ${f.validation_needed}`);
      if (f.evidence_class) lines.push(`  Evidence: ${f.evidence_class}`);
      lines.push("");
    });
  }
  lines.push("5. WHAT WE COULD NOT VALIDATE");
  if (i.unknowns.length === 0) lines.push("—");
  for (const u of i.unknowns) lines.push(`• ${u}`);
  lines.push("");
  lines.push("6. RECOMMENDED NEXT STEP");
  lines.push(
    i.recommendation ?? "To be determined at the findings review meeting.",
  );
  if (i.rationale) lines.push(i.rationale);
  lines.push("");
  lines.push("7. IMPORTANT NOTE");
  lines.push(
    "This summary reflects a limited onsite walkthrough. Observations classified as Reported, Inferred or Requires Validation have not been independently verified, and no root cause is confirmed. Restore Capability. Preserve Readiness.®",
  );
  return lines.join("\n");
}
