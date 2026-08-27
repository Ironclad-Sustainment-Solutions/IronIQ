/**
 * RFQ, Estimating & CAM domain model.
 * Mirrors the Postgres schema for the Manufacturing Services module.
 */

export type RfqStatus =
  | "new"
  | "awaiting_information"
  | "geometry_analysis"
  | "ready_for_estimating"
  | "awaiting_internal_approval"
  | "quote_sent"
  | "quote_accepted"
  | "programming"
  | "awaiting_verification"
  | "completed"
  | "declined"
  | "expired";

export const RFQ_STATUS_LABELS: Record<RfqStatus, string> = {
  new: "New RFQ",
  awaiting_information: "Awaiting information",
  geometry_analysis: "Geometry analysis",
  ready_for_estimating: "Ready for estimating",
  awaiting_internal_approval: "Awaiting internal approval",
  quote_sent: "Quote sent",
  quote_accepted: "Quote accepted",
  programming: "Programming in progress",
  awaiting_verification: "Awaiting verification",
  completed: "Completed",
  declined: "Declined",
  expired: "Expired",
};

export const RFQ_STATUS_ORDER: RfqStatus[] = [
  "new",
  "awaiting_information",
  "geometry_analysis",
  "ready_for_estimating",
  "awaiting_internal_approval",
  "quote_sent",
  "quote_accepted",
  "programming",
  "awaiting_verification",
  "completed",
  "declined",
  "expired",
];

export type RfqKind = "prototype" | "repeat_production" | "new_production";
export const RFQ_KIND_LABELS: Record<RfqKind, string> = {
  prototype: "Prototype",
  repeat_production: "Repeat production",
  new_production: "New production",
};

export type MachineType =
  | "mill_3axis"
  | "mill_4axis"
  | "mill_5axis"
  | "lathe"
  | "mill_turn"
  | "router"
  | "edm"
  | "grinding"
  | "other";

export const MACHINE_TYPE_LABELS: Record<MachineType, string> = {
  mill_3axis: "3-axis mill",
  mill_4axis: "4-axis mill",
  mill_5axis: "5-axis mill",
  lathe: "Lathe",
  mill_turn: "Mill-turn",
  router: "Router",
  edm: "EDM",
  grinding: "Grinding",
  other: "Other",
};

export type EstimateConfidence =
  "high" | "moderate" | "low" | "manual_required";
export const CONFIDENCE_LABELS: Record<EstimateConfidence, string> = {
  high: "High",
  moderate: "Moderate",
  low: "Low",
  manual_required: "Manual quote required",
};

export type QuoteStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "returned"
  | "rejected"
  | "sent"
  | "accepted"
  | "declined"
  | "changes_requested"
  | "expired";

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  returned: "Returned for revision",
  rejected: "Rejected",
  sent: "Sent to customer",
  accepted: "Accepted",
  declined: "Declined",
  changes_requested: "Changes requested",
  expired: "Expired",
};

export type WorkOrderStatus =
  | "not_started"
  | "reviewing_files"
  | "programming"
  | "internal_questions"
  | "customer_clarification"
  | "simulation"
  | "revision_required"
  | "approved"
  | "released"
  | "completed";

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  not_started: "Not started",
  reviewing_files: "Reviewing files",
  programming: "Programming",
  internal_questions: "Internal questions",
  customer_clarification: "Customer clarification required",
  simulation: "Simulation",
  revision_required: "Revision required",
  approved: "Approved",
  released: "Released",
  completed: "Completed",
};

export const WORK_ORDER_STATUS_ORDER: WorkOrderStatus[] = [
  "not_started",
  "reviewing_files",
  "programming",
  "internal_questions",
  "customer_clarification",
  "simulation",
  "revision_required",
  "approved",
  "released",
  "completed",
];

export type RfqFileKind =
  | "model_3d"
  | "drawing"
  | "supporting"
  | "cam"
  | "nc_program"
  | "simulation_report"
  | "quote_document";

export const FILE_KIND_LABELS: Record<RfqFileKind, string> = {
  model_3d: "3D model",
  drawing: "Drawing",
  supporting: "Supporting file",
  cam: "CAM file",
  nc_program: "NC program",
  simulation_report: "Simulation report",
  quote_document: "Quote document",
};

/** Extension -> bucket + logical kind. Enforced again server-side on upload. */
export const ACCEPTED_EXTENSIONS: Record<
  string,
  { kind: RfqFileKind; bucket: string }
> = {
  step: { kind: "model_3d", bucket: "rfq-source-models" },
  stp: { kind: "model_3d", bucket: "rfq-source-models" },
  x_t: { kind: "model_3d", bucket: "rfq-source-models" },
  x_b: { kind: "model_3d", bucket: "rfq-source-models" },
  iges: { kind: "model_3d", bucket: "rfq-source-models" },
  igs: { kind: "model_3d", bucket: "rfq-source-models" },
  stl: { kind: "model_3d", bucket: "rfq-source-models" },
  mcam: { kind: "model_3d", bucket: "rfq-source-models" },
  pdf: { kind: "drawing", bucket: "rfq-drawings" },
  jpg: { kind: "drawing", bucket: "rfq-drawings" },
  jpeg: { kind: "drawing", bucket: "rfq-drawings" },
  png: { kind: "drawing", bucket: "rfq-drawings" },
  zip: { kind: "supporting", bucket: "rfq-supporting-files" },
};

export const ACCEPT_ATTRIBUTE =
  ".step,.stp,.x_t,.x_b,.iges,.igs,.stl,.pdf,.mcam,.zip,.jpg,.jpeg,.png";

/** 200 MB ceiling per file. */
export const MAX_FILE_BYTES = 200 * 1024 * 1024;

export function fileExtension(name: string) {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function classifyFile(name: string) {
  return ACCEPTED_EXTENSIONS[fileExtension(name)] ?? null;
}

export function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function currency(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export interface Rfq {
  id: string;
  organization_id: string;
  facility_id: string | null;
  rfq_number: string;
  customer_rfq_number: string | null;
  title: string;
  contact_name: string | null;
  contact_email: string | null;
  project_description: string | null;
  required_date: string | null;
  rfq_kind: RfqKind;
  export_controlled: boolean;
  itar: boolean;
  cui: boolean;
  status: RfqStatus;
  assigned_estimator: string | null;
  assigned_programmer: string | null;
  files_use_confirmed: boolean;
  submitted_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface RfqPart {
  id: string;
  rfq_id: string;
  organization_id: string;
  part_number: string;
  revision: string | null;
  description: string | null;
  quantity: number;
  quantity_breaks: unknown;
  sort_order: number;
}

export interface RfqRequirement {
  id: string;
  rfq_part_id: string;
  material_id: string | null;
  material_text: string | null;
  material_grade: string | null;
  customer_supplied_material: boolean;
  stock_shape: string | null;
  stock_dim_a: number | null;
  stock_dim_b: number | null;
  stock_dim_c: number | null;
  units: string;
  general_tolerance: string | null;
  critical_tolerances: string | null;
  surface_finish: string | null;
  thread_requirements: string | null;
  heat_treatment: string | null;
  coating: string | null;
  inspection_level: string | null;
  material_certification: boolean;
  fai_required: boolean;
  special_packaging: string | null;
  notes: string | null;
  requested_machine_type: MachineType | null;
  customer_required_machine: string | null;
  preferred_process: string | null;
  existing_fixture: boolean;
  existing_program: boolean;
  existing_tooling_notes: string | null;
  target_price: number | null;
  requested_turnaround_days: number | null;
}

export interface RfqFile {
  id: string;
  rfq_id: string;
  rfq_part_id: string | null;
  organization_id: string;
  bucket: string;
  storage_path: string;
  file_name: string;
  file_extension: string;
  file_size: number;
  file_kind: RfqFileKind;
  revision: number;
  superseded: boolean;
  checksum: string | null;
  upload_status: string;
  created_at: string;
}

export interface Machine {
  id: string;
  facility_id: string | null;
  manufacturer: string;
  model: string;
  machine_type: MachineType;
  axis_count: number;
  envelope_x: number | null;
  envelope_y: number | null;
  envelope_z: number | null;
  max_stock_x: number | null;
  max_stock_y: number | null;
  max_stock_z: number | null;
  max_spindle_rpm: number | null;
  spindle_power_hp: number | null;
  machine_definition: string | null;
  post_processor: string | null;
  hourly_burden_rate: number;
  setup_labor_rate: number;
  active: boolean;
}

export interface Material {
  id: string;
  family: string;
  grade: string;
  form: string;
  density_lb_in3: number;
  cost_per_pound: number;
  cost_per_stock_unit: number | null;
  waste_factor: number;
  machinability_rating: number;
  programming_complexity_factor: number;
  cycle_time_factor: number;
  tool_wear_factor: number;
  preferred_tooling_notes: string | null;
  supplier: string | null;
  specialty: boolean;
  effective_date: string;
  active: boolean;
}

export interface Tool {
  id: string;
  tool_number: string | null;
  description: string;
  tool_type: string;
  diameter: number | null;
  flute_count: number | null;
  material: string | null;
  coating: string | null;
  cost: number;
  expected_life_minutes: number | null;
  supplier: string | null;
  active: boolean;
}

export interface GeometryAnalysisRun {
  id: string;
  rfq_part_id: string;
  rfq_file_id: string | null;
  provider: string;
  provider_version: string;
  status: string;
  requested_at: string;
  completed_at: string | null;
  result: GeometryResult | null;
  warnings: string[];
  manual_review_required: boolean;
  uncertainty: number | null;
}

export interface GeometryResult {
  bounding_box: { x: number; y: number; z: number; units: string };
  volume_in3: number;
  surface_area_in2: number;
  estimated_finished_weight_lb: number;
  material_removal_ratio: number;
  hole_count: number;
  pocket_count: number;
  slot_count: number;
  undercuts: number;
  thin_wall_indicator: boolean;
  suggested_setups: number;
  suggested_machine_type: MachineType;
  complexity_score: number;
  manual_review_flags: string[];
}

export interface Estimate {
  id: string;
  rfq_id: string;
  rfq_part_id: string;
  organization_id: string;
  facility_id: string | null;
  machine_id: string | null;
  quantity: number;
  programming_hours: number;
  setup_count: number;
  setup_hours: number;
  cycle_time_minutes: number;
  total_cost: number;
  target_margin: number;
  recommended_price: number;
  confidence: EstimateConfidence;
  manual_review_reasons: string[];
  estimator_notes: string | null;
  status: string;
  created_at: string;
}

export interface EstimateLineItem {
  id: string;
  estimate_id: string;
  line_key: string;
  label: string;
  category: string;
  calculated_value: number;
  value: number;
  source: string;
  assumption: string | null;
  overridden: boolean;
  override_reason: string | null;
  original_value: number | null;
  overridden_by: string | null;
  overridden_at: string | null;
  sort_order: number;
}

export interface Quote {
  id: string;
  rfq_id: string;
  estimate_id: string | null;
  organization_id: string;
  quote_number: string;
  revision: number;
  status: QuoteStatus;
  unit_price: number;
  quantity: number;
  nre_charge: number;
  tooling_charge: number;
  lead_time_days: number | null;
  freight_terms: string | null;
  payment_terms: string | null;
  expires_on: string | null;
  assumptions: string | null;
  exclusions: string | null;
  preliminary: boolean;
  sent_at: string | null;
  responded_at: string | null;
  customer_response_note: string | null;
  created_at: string;
}

export interface ProgrammingWorkOrder {
  id: string;
  quote_id: string | null;
  rfq_id: string;
  rfq_part_id: string | null;
  organization_id: string;
  facility_id: string | null;
  work_order_number: string;
  priority: string;
  assigned_programmer: string | null;
  due_date: string | null;
  machine_id: string | null;
  machine_definition: string | null;
  post_processor: string | null;
  required_tooling: string | null;
  approved_material: string | null;
  approved_stock: string | null;
  estimated_programming_hours: number;
  actual_programming_hours: number | null;
  status: WorkOrderStatus;
  programmer_notes: string | null;
  programmer_approved_by: string | null;
  programmer_approved_at: string | null;
  simulation_recorded: boolean;
  post_processor_confirmed: boolean;
  machine_confirmed: boolean;
  revision_confirmed: boolean;
  final_approver: string | null;
  final_approved_at: string | null;
  released_at: string | null;
  created_at: string;
}

export interface HistoricalJob {
  id: string;
  organization_id: string;
  part_number: string;
  revision: string | null;
  machine_id: string | null;
  material_id: string | null;
  programmer_id: string | null;
  complexity_score: number | null;
  completed_on: string | null;
}

export interface ActualJobResult {
  id: string;
  historical_job_id: string;
  estimated_programming_hours: number | null;
  actual_programming_hours: number | null;
  estimated_setup_hours: number | null;
  actual_setup_hours: number | null;
  estimated_cycle_minutes: number | null;
  actual_cycle_minutes: number | null;
  estimated_tooling_cost: number | null;
  actual_tooling_cost: number | null;
  quoted_material_cost: number | null;
  actual_material_cost: number | null;
  quoted_margin: number | null;
  realized_margin: number | null;
  revision_count: number;
  on_time: boolean | null;
  scrap_or_rework: string | null;
  root_cause_notes: string | null;
}

/** Release gate — an NC program is never released just because a file exists. */
export function releaseBlockers(wo: ProgrammingWorkOrder): string[] {
  const blockers: string[] = [];
  if (!wo.programmer_approved_by)
    blockers.push("Programmer approval is required.");
  if (!wo.simulation_recorded)
    blockers.push("A simulation result must be recorded.");
  if (!wo.post_processor_confirmed)
    blockers.push("Post processor must be confirmed.");
  if (!wo.machine_confirmed) blockers.push("Machine must be confirmed.");
  if (!wo.revision_confirmed) blockers.push("Part revision must be confirmed.");
  if (!wo.final_approver) blockers.push("A final approver must sign off.");
  return blockers;
}
