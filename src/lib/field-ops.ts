/**
 * Field operations layer — production events, changeover timing, loss capture,
 * causal chains, baseline metrics, pilots and ROI.
 *
 * These types and helpers extend the existing Field Capability Assessment; they
 * do not replace the capability-gap workflow already in place. Nothing here
 * invents a financial number: every ROI figure is derived only from assumptions
 * the assessor typed in.
 */

export const EVENT_TYPES = [
  "Changeover",
  "Setup",
  "First-piece qualification",
  "Production interruption",
  "Program issue",
  "Fixture issue",
  "Tooling issue",
  "Inspection delay",
  "Machine issue",
  "Material/casting issue",
  "Operator assistance",
  "Other",
] as const;

export const LOSS_CATEGORIES = [
  "Fixture",
  "Program",
  "Tooling",
  "Datum / Offset / Probing",
  "Work Instructions",
  "Inspection",
  "Operator / Knowledge",
  "Machine",
  "Material / Casting",
  "Production Operations",
  "Other",
] as const;

export const EVIDENCE_TYPES = [
  "Photo",
  "Video",
  "Document",
  "Screenshot",
  "Measurement",
  "Machine reading",
  "Timestamp",
  "Operator statement",
  "ISS observation",
  "Existing production record",
  "Inspection result",
  "Program reference",
  "Fixture reference",
  "Setup sheet reference",
] as const;

export const CONFIDENCE_LEVELS = ["Low", "Medium", "High"] as const;
export const VALIDATION_STATUSES = [
  "Suspected",
  "Evidence Gathering",
  "Validated",
  "Rejected",
] as const;

export const DATA_CLASSES = [
  "Estimated",
  "Client Reported",
  "Observed",
  "Calculated",
  "Validated",
] as const;

export const OPPORTUNITY_STATUSES = [
  "Identified",
  "Needs Validation",
  "Ready for Proposal",
  "Proposed",
  "Approved",
  "In Progress",
  "Implemented",
  "Validated",
  "Closed",
] as const;

export const COMPLEXITY_LEVELS = ["Low", "Moderate", "High", "Very high"] as const;

/** Capability domains used across IronIQ, with the ISS verb for each. */
export const CAPABILITY_DOMAINS = [
  { code: "technical_data", label: "Technical Data", verb: "Define it" },
  { code: "digital_manufacturing", label: "Digital Manufacturing", verb: "Digitize it" },
  { code: "production_support", label: "Production Support", verb: "Support it" },
  { code: "production_operations", label: "Production Operations", verb: "Execute it" },
  { code: "equipment_infrastructure", label: "Equipment & Infrastructure", verb: "Enable it" },
  { code: "workforce_knowledge", label: "Workforce & Knowledge", verb: "Sustain it" },
] as const;

/** Ordered one-tap marks for the changeover timer. None are required. */
export const CHANGEOVER_MARKS = [
  { code: "prev_stopped", label: "Previous production stopped" },
  { code: "fixture_removal", label: "Fixture removal started" },
  { code: "fixture_install", label: "New fixture installation started" },
  { code: "fixture_installed", label: "Fixture installed" },
  { code: "tooling_complete", label: "Tooling completed" },
  { code: "program_loaded", label: "Program selected / loaded" },
  { code: "datum_set", label: "Datum / offsets established" },
  { code: "first_cycle", label: "First cycle started" },
  { code: "first_piece", label: "First piece completed" },
  { code: "inspection_started", label: "Inspection started" },
  { code: "first_piece_accepted", label: "First piece accepted" },
  { code: "production_released", label: "Production released" },
] as const;

export const CAUSE_LEVELS = [
  { key: "observed_condition", label: "Observed condition" },
  { key: "effect", label: "Effect" },
  { key: "immediate_cause", label: "Immediate cause" },
  { key: "contributing_cause", label: "Contributing cause" },
  { key: "capability_gap", label: "Underlying capability gap" },
] as const;

export const BASELINE_METRIC_PRESETS = [
  { code: "changeover_duration", name: "Changeover duration", unit: "hours" },
  { code: "time_to_first_cycle", name: "Time to first cycle", unit: "minutes" },
  { code: "time_to_first_piece", name: "Time to acceptable first piece", unit: "minutes" },
  { code: "first_piece_accept_rate", name: "First-piece acceptance rate", unit: "%" },
  { code: "setup_adjustments", name: "Setup adjustments", unit: "count / setup" },
  { code: "assistance_events", name: "External/operator assistance events", unit: "count / week" },
  { code: "expert_dependency", name: "Expert dependency", unit: "% of setups" },
  { code: "scrap", name: "Scrap", unit: "pieces / week" },
  { code: "rework", name: "Rework", unit: "pieces / week" },
  { code: "lost_machine_hours", name: "Lost machine hours", unit: "hours / week" },
  { code: "events_per_week", name: "Events per week", unit: "count / week" },
  { code: "annual_impact", name: "Estimated annual production impact", unit: "hours / year" },
] as const;

export const PILOT_SCORES = [
  { key: "score_frequency", label: "Frequency" },
  { key: "score_production_impact", label: "Production impact" },
  { key: "score_evidence_strength", label: "Evidence strength" },
  { key: "score_controllability", label: "Controllability" },
  { key: "score_feasibility", label: "Implementation feasibility" },
  { key: "score_measurability", label: "Measurement ability" },
  { key: "score_replication", label: "Replication potential" },
] as const;

export const DAY_FOCUS = [
  {
    key: "day1",
    label: "Day 1 — Establish reality",
    focus: ["Observe", "Time events", "Capture delays", "Gather evidence", "Avoid conclusions"],
    indicators: [
      "Candidate parts selected",
      "Machines identified",
      "At least one event observed",
      "Initial delay events captured",
      "Baseline data started",
    ],
  },
  {
    key: "day2",
    label: "Day 2 — Trace causes",
    focus: [
      "Compare events",
      "Compare operators",
      "Trace major losses backward",
      "Validate suspected causes",
      "Capture SME knowledge",
    ],
    indicators: [
      "Top recurring losses identified",
      "Causal chains started",
      "Evidence attached",
      "Capability domains mapped",
      "Suspected causes validated or rejected",
    ],
  },
  {
    key: "day3",
    label: "Day 3 — Validate & recommend",
    focus: [
      "Confirm dominant capability gap",
      "Finalize baseline",
      "Choose pilot",
      "Define success measurement",
      "Prepare next-phase recommendation",
    ],
    indicators: [
      "Validated baseline",
      "Major loss sources ranked",
      "Dominant capability gap",
      "Pilot candidate selected",
      "Success metric selected",
      "Implementation recommendation prepared",
    ],
  },
] as const;

export const DEFAULT_OPERATIONAL_QUESTION =
  "What prevents this machine from transitioning from one production job to another and producing an acceptable first piece quickly, consistently, and repeatably?";

/* ------------------------------- row types -------------------------------- */

export interface ProductionEventRow {
  id: string;
  field_assessment_id: string;
  event_type: string;
  machine: string | null;
  part: string | null;
  operator: string | null;
  shift: string | null;
  occurred_at: string;
  fixture: string | null;
  program: string | null;
  tooling_package: string | null;
  material: string | null;
  work_order: string | null;
  previous_job: string | null;
  incoming_job: string | null;
  notes: string | null;
  timer_started_at: string | null;
  troubleshooting_started_at: string | null;
  troubleshooting_resolution: string | null;
  status: string;
  created_at: string;
}

export interface EventMarkRow {
  id: string;
  event_id: string;
  mark_code: string;
  marked_at: string;
  original_at: string | null;
  edit_history: { at: string; from: string; by?: string | null }[];
  note: string | null;
}

export interface DelayRow {
  id: string;
  field_assessment_id: string;
  event_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  minutes_lost: number | null;
  loss_category: string;
  what_happened: string | null;
  person_involved: string | null;
  machine: string | null;
  part: string | null;
  created_at: string;
}

export interface CauseNodeRow {
  id: string;
  field_assessment_id: string;
  event_id: string | null;
  delay_id: string | null;
  chain_key: string;
  level: string;
  description: string | null;
  confidence: string;
  validation_status: string;
  domain_codes: string[];
  is_dominant: boolean;
  sort_order: number;
}

export interface EvidenceItemRow {
  id: string;
  field_assessment_id: string;
  event_id: string | null;
  delay_id: string | null;
  cause_id: string | null;
  observation_id: string | null;
  gap_id: string | null;
  evidence_type: string;
  description: string | null;
  captured_by: string | null;
  captured_at: string;
  machine: string | null;
  part: string | null;
  storage_path: string | null;
  file_name: string | null;
}

export interface SmeDependencyRow {
  id: string;
  field_assessment_id: string;
  sme_name: string | null;
  scope: string | null;
  does_differently: string | null;
  decisions_made: string | null;
  undocumented_knowledge: string | null;
  common_adjustments: string | null;
  assistance_frequency: string | null;
  impact_when_absent: string | null;
  method_comparison: { aspect: string; best: string; typical: string }[];
}

export interface BaselineMetricRow {
  id: string;
  field_assessment_id: string;
  metric_code: string | null;
  metric_name: string;
  value: number | null;
  unit: string | null;
  measurement_period: string | null;
  source: string | null;
  evidence_note: string | null;
  confidence: string;
  data_class: string;
  sort_order: number;
}

export interface OpportunityRow {
  id: string;
  field_assessment_id: string;
  opportunity: string | null;
  impact: string | null;
  effort: string | null;
  priority: string | null;
  sort_order: number;
  title: string | null;
  problem: string | null;
  capability_gap: string | null;
  domain_code: string | null;
  affected_machines: string | null;
  affected_parts: string | null;
  expected_impact: string | null;
  recommended_action: string | null;
  complexity: string | null;
  phase: string | null;
  workflow_status: string | null;
  is_pilot_candidate: boolean;
  gap_id: string | null;
}

export interface PilotRow {
  id: string;
  field_assessment_id: string;
  opportunity_id: string | null;
  title: string | null;
  is_recommended: boolean;
  score_frequency: number | null;
  score_production_impact: number | null;
  score_evidence_strength: number | null;
  score_controllability: number | null;
  score_feasibility: number | null;
  score_measurability: number | null;
  score_replication: number | null;
  scope_part: string | null;
  scope_machine: string | null;
  scope_fixture: string | null;
  scope_capability_gap: string | null;
  scope_outcome: string | null;
  scope_exceptions: string | null;
  current_condition: string | null;
  validated_gap: string | null;
  proposed_change: string | null;
  affected_metric: string | null;
  validation_method: string | null;
  deliverables: string | null;
  exclusions: string | null;
  target_completion: string | null;
  estimated_price: number | null;
  approval_status: string;
  implementation_status: string;
  implementation_notes: string | null;
  machine_burden_rate: number | null;
  labor_rate: number | null;
  production_value_hour: number | null;
  scrap_cost: number | null;
  overtime_cost: number | null;
  other_cost_basis: number | null;
  iss_implementation_cost: number | null;
  hours_recovered_week: number | null;
  financial_class: string;
}

export interface PilotMetricRow {
  id: string;
  pilot_id: string;
  baseline_metric_id: string | null;
  metric_name: string;
  unit: string | null;
  before_value: number | null;
  after_value: number | null;
  measured_at: string | null;
  data_class: string;
  note: string | null;
  sort_order: number;
}

/* ------------------------------ calculations ------------------------------ */

const minutesBetween = (a?: string | null, b?: string | null) =>
  a && b ? Math.round(((new Date(b).getTime() - new Date(a).getTime()) / 60000) * 10) / 10 : null;

export interface ChangeoverDurations {
  totalChangeover: number | null;
  setupTime: number | null;
  timeToFirstCycle: number | null;
  firstPieceQualification: number | null;
  timeToProductionRelease: number | null;
}

/** Derive changeover durations from whichever marks the assessor captured. */
export function computeDurations(marks: EventMarkRow[]): ChangeoverDurations {
  const at = (code: string) => marks.find((m) => m.mark_code === code)?.marked_at ?? null;
  const start = at("prev_stopped") ?? at("fixture_removal") ?? at("fixture_install");
  return {
    totalChangeover: minutesBetween(start, at("production_released") ?? at("first_piece_accepted")),
    setupTime: minutesBetween(start, at("datum_set") ?? at("program_loaded") ?? at("tooling_complete")),
    timeToFirstCycle: minutesBetween(start, at("first_cycle")),
    firstPieceQualification: minutesBetween(
      at("first_piece") ?? at("first_cycle"),
      at("first_piece_accepted"),
    ),
    timeToProductionRelease: minutesBetween(start, at("production_released")),
  };
}

export function formatMinutes(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (value < 60) return `${Math.round(value)} min`;
  const h = Math.floor(value / 60);
  const m = Math.round(value % 60);
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** Minutes lost for a delay: explicit entry wins, otherwise derive from times. */
export function delayMinutes(row: DelayRow) {
  if (typeof row.minutes_lost === "number") return row.minutes_lost;
  return minutesBetween(row.started_at, row.ended_at) ?? 0;
}

export function lossByCategory(delays: DelayRow[]) {
  const totals = new Map<string, { minutes: number; count: number }>();
  for (const d of delays) {
    const cur = totals.get(d.loss_category) ?? { minutes: 0, count: 0 };
    cur.minutes += delayMinutes(d);
    cur.count += 1;
    totals.set(d.loss_category, cur);
  }
  return [...totals.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Pilot decision aid — a score out of 35. Never an automatic selection. */
export function pilotScore(pilot: Partial<PilotRow>) {
  const values = PILOT_SCORES.map((s) => pilot[s.key] as number | null | undefined).filter(
    (v): v is number => typeof v === "number",
  );
  return {
    total: values.reduce((a, b) => a + b, 0),
    max: 35,
    answered: values.length,
    of: PILOT_SCORES.length,
  };
}

export interface RoiResult {
  hoursPerWeek: number | null;
  annualHours: number | null;
  hourlyValue: number | null;
  annualValue: number | null;
  cost: number | null;
  paybackWeeks: number | null;
  roiPercent: number | null;
  missing: string[];
}

/**
 * ROI from assessor-entered assumptions only. When an assumption is missing the
 * figure stays null and is reported as missing rather than guessed.
 */
export function computeRoi(pilot: Partial<PilotRow>): RoiResult {
  const missing: string[] = [];
  const hoursPerWeek = numOrNull(pilot.hours_recovered_week);
  if (hoursPerWeek === null) missing.push("Hours recovered per week");

  const rates = [
    numOrNull(pilot.production_value_hour),
    numOrNull(pilot.machine_burden_rate),
    numOrNull(pilot.labor_rate),
  ].filter((v): v is number => v !== null);
  const hourlyValue = rates.length ? rates.reduce((a, b) => a + b, 0) : null;
  if (hourlyValue === null) missing.push("An hourly cost basis (production value, burden or labor rate)");

  const cost = numOrNull(pilot.iss_implementation_cost);
  if (cost === null) missing.push("ISS implementation cost");

  const annualHours = hoursPerWeek === null ? null : round2(hoursPerWeek * 52);
  const annualValue =
    annualHours === null || hourlyValue === null ? null : round2(annualHours * hourlyValue);
  const weeklyValue = hoursPerWeek === null || hourlyValue === null ? null : hoursPerWeek * hourlyValue;
  const paybackWeeks =
    cost === null || !weeklyValue || weeklyValue <= 0 ? null : round2(cost / weeklyValue);
  const roiPercent =
    cost === null || cost <= 0 || annualValue === null
      ? null
      : round2(((annualValue - cost) / cost) * 100);

  return { hoursPerWeek, annualHours, hourlyValue, annualValue, cost, paybackWeeks, roiPercent, missing };
}

export function metricDelta(before: number | null, after: number | null) {
  if (before === null || after === null) return { difference: null, percent: null };
  const difference = round2(after - before);
  const percent = before === 0 ? null : round2((difference / Math.abs(before)) * 100);
  return { difference, percent };
}

function numOrNull(v: unknown) {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}
