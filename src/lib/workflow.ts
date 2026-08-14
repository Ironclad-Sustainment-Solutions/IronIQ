/**
 * Production Flow — CNC job lifecycle model.
 * 36 job states across seven stages, plus the checklists and controls that
 * gate each stage. Ported into IronIQ's organization/facility tenancy.
 */
import type { Database } from "@/integrations/supabase/types";

export type JobStatus = Database["public"]["Enums"]["job_status"];
export type IntakeResult = Database["public"]["Enums"]["intake_result"];
export type SimulationStatus = Database["public"]["Enums"]["simulation_status"];
export type IntegrationMode = Database["public"]["Enums"]["integration_mode"];
export type RecommendationDecision = Database["public"]["Enums"]["recommendation_decision"];
export type CheckSeverity = Database["public"]["Enums"]["check_severity"];
export type ComplexityLevel = Database["public"]["Enums"]["complexity_level"];
export type ExceptionKind = Database["public"]["Enums"]["exception_kind"];
export type ExceptionStatus = Database["public"]["Enums"]["exception_status"];

export const AI_STATEMENT =
  "AI assists with manufacturing planning and programming preparation. Final responsibility for program validation, posting, and production release remains with the assigned qualified programmer.";

export const PRELIMINARY_LABEL = "Preliminary — Programmer Review Required";
export const AUTOMATION_LABEL = "Automation Generated — Programmer Validation Required";

export const PRODUCTION_LICENSE =
  "Ironclad Sustainment Solutions grants the named customer a non-transferable license to use this CNC program and setup documentation for production of the identified part number and revision on the identified machine. Any modification, transfer to another machine, or use on a different part revision voids validation and requires re-approval by a qualified programmer.";

type StatusMeta = { label: string; stage: ProductionStage };

export type ProductionStage =
  | "Intake"
  | "Planning"
  | "Programming"
  | "Verification"
  | "Approval"
  | "Release"
  | "Feedback";

export const PRODUCTION_STAGES: ProductionStage[] = [
  "Intake",
  "Planning",
  "Programming",
  "Verification",
  "Approval",
  "Release",
  "Feedback",
];

export const JOB_STATUS_META: Record<JobStatus, StatusMeta> = {
  customer_submission_draft: { label: "Customer Submission Draft", stage: "Intake" },
  customer_data_submitted: { label: "Customer Data Submitted", stage: "Intake" },
  iss_intake_review: { label: "Intake Review", stage: "Intake" },
  missing_information: { label: "Missing Information", stage: "Intake" },
  digital_data_recovery_required: { label: "Digital Data Recovery Required", stage: "Intake" },
  machine_profile_review: { label: "Machine Profile Review", stage: "Intake" },
  tooling_review_required: { label: "Tooling Review Required", stage: "Intake" },
  fixture_review_required: { label: "Fixture Review Required", stage: "Intake" },
  ready_for_ai_planning: { label: "Ready for AI Planning", stage: "Planning" },
  ai_manufacturing_plan_in_progress: { label: "AI Manufacturing Plan In Progress", stage: "Planning" },
  ai_manufacturing_plan_generated: { label: "AI Manufacturing Plan Generated", stage: "Planning" },
  programmer_plan_review: { label: "Programmer Plan Review", stage: "Planning" },
  manufacturing_plan_approved: { label: "Manufacturing Plan Approved", stage: "Planning" },
  mastercam_integration_pending: { label: "CAM Integration Pending", stage: "Programming" },
  mastercam_job_created: { label: "CAM Job Created", stage: "Programming" },
  toolpath_generation_in_progress: { label: "Toolpath Generation In Progress", stage: "Programming" },
  preliminary_toolpaths_generated: { label: "Preliminary Toolpaths Generated", stage: "Programming" },
  automated_checks_in_progress: { label: "Automated Checks In Progress", stage: "Verification" },
  corrections_required: { label: "Corrections Required", stage: "Verification" },
  ready_for_simulation: { label: "Ready for Simulation", stage: "Verification" },
  simulation_in_progress: { label: "Simulation In Progress", stage: "Verification" },
  simulation_failed: { label: "Simulation Failed", stage: "Verification" },
  simulation_passed_with_warnings: { label: "Simulation Passed with Warnings", stage: "Verification" },
  simulation_passed: { label: "Simulation Passed", stage: "Verification" },
  programmer_approval_pending: { label: "Programmer Approval Pending", stage: "Approval" },
  programmer_revisions_in_progress: { label: "Programmer Revisions In Progress", stage: "Approval" },
  programmer_approved: { label: "Programmer Approved", stage: "Approval" },
  posting_in_progress: { label: "Posting In Progress", stage: "Release" },
  posted_code_review: { label: "Posted Code Review", stage: "Release" },
  setup_sheet_generation: { label: "Setup Sheet Generation", stage: "Release" },
  final_technical_review: { label: "Final Technical Review", stage: "Release" },
  ready_for_customer_release: { label: "Ready for Customer Release", stage: "Release" },
  released_to_customer: { label: "Released to Customer", stage: "Release" },
  customer_prove_out: { label: "Customer Prove-Out", stage: "Feedback" },
  revision_requested: { label: "Revision Requested", stage: "Feedback" },
  completed: { label: "Completed", stage: "Feedback" },
};

export const JOB_STATUSES = Object.keys(JOB_STATUS_META) as JobStatus[];

export function statusLabel(status: JobStatus | null | undefined) {
  return status ? JOB_STATUS_META[status].label : "—";
}

export const BLOCKING_STATUSES: JobStatus[] = [
  "missing_information",
  "digital_data_recovery_required",
  "tooling_review_required",
  "fixture_review_required",
  "corrections_required",
  "simulation_failed",
  "revision_requested",
];

export const COMPLEXITY_LABELS: Record<ComplexityLevel, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  very_high: "Very High",
};

export const COMPLEXITY_LEVELS: ComplexityLevel[] = ["low", "moderate", "high", "very_high"];

export const INTAKE_RESULT_META: Record<IntakeResult, string> = {
  ready_for_ai_planning: "Ready for AI Planning",
  human_intake_review_required: "Human Intake Review Required",
  missing_customer_information: "Missing Customer Information",
  tooling_review_required: "Tooling Review Required",
  fixture_review_required: "Fixture Review Required",
  digital_data_recovery_required: "Digital Data Recovery Required",
  unsupported_machine_or_controller: "Unsupported Machine or Controller",
  manual_programming_required: "Manual Programming Required",
};

export const INTAKE_RESULT_TO_STATUS: Record<IntakeResult, JobStatus> = {
  ready_for_ai_planning: "ready_for_ai_planning",
  human_intake_review_required: "iss_intake_review",
  missing_customer_information: "missing_information",
  tooling_review_required: "tooling_review_required",
  fixture_review_required: "fixture_review_required",
  digital_data_recovery_required: "digital_data_recovery_required",
  unsupported_machine_or_controller: "machine_profile_review",
  manual_programming_required: "mastercam_integration_pending",
};

export const SIMULATION_STATUS_META: Record<SimulationStatus, string> = {
  not_simulated: "Not Simulated",
  simulation_in_progress: "Simulation In Progress",
  simulation_failed: "Simulation Failed",
  corrections_required: "Corrections Required",
  simulation_passed_with_warnings: "Simulation Passed with Warnings",
  simulation_passed: "Simulation Passed",
  human_verification_required: "Human Verification Required",
};

export const INTEGRATION_MODE_META: Record<IntegrationMode, { label: string; description: string }> = {
  direct_automation: {
    label: "Mode 1 — Direct Automation",
    description:
      "IronIQ communicates directly with a supported CAM API or add-in and creates the preliminary programming structure automatically.",
  },
  guided_add_in: {
    label: "Mode 2 — Guided CAM Add-In",
    description:
      "The programmer opens the job in Mastercam and uses the add-in to import job, setup, stock, tooling, operation plan and customer requirements.",
  },
  structured_package: {
    label: "Mode 3 — Structured Programming Package",
    description:
      "IronIQ produces a structured programming package and the programmer builds the CAM program manually.",
  },
};

export const DECISION_META: Record<RecommendationDecision, string> = {
  accepted: "Accepted",
  modified: "Modified",
  rejected: "Rejected",
  not_applicable: "Not Applicable",
};

export const CHANGE_REASONS = [
  "Machine limitation",
  "Tooling limitation",
  "Workholding limitation",
  "Post-processor limitation",
  "Surface-finish concern",
  "Tolerance concern",
  "Cycle-time improvement",
  "Collision risk",
  "Tool-reach concern",
  "Programmer experience",
  "Customer preference",
  "Better manufacturing method",
  "Incorrect AI interpretation",
] as const;

export const INTAKE_CHECKS = [
  { key: "revision", label: "Correct part revision submitted" },
  { key: "cad_openable", label: "CAD model or drawing can be opened" },
  { key: "conflicts", label: "No missing or conflicting information" },
  { key: "machine_profile", label: "Matched to an approved customer machine profile" },
  { key: "controller_post", label: "Controller and post-processor requirements confirmed" },
  { key: "material_stock", label: "Material and stock dimensions confirmed" },
  { key: "workholding", label: "Workholding constraints confirmed" },
  { key: "tooling", label: "Tooling availability confirmed" },
  { key: "critical_features", label: "Critical features and tolerances identified" },
  { key: "inspection", label: "Inspection requirements identified" },
] as const;

export const AUTOMATED_CHECKS = [
  "Missing tools",
  "Duplicate tool numbers",
  "Unsupported tools",
  "Excessive tool stick-out",
  "Tool reach",
  "Holder clearance",
  "Fixture clearance",
  "Machine travel limits",
  "Rotary-axis limits",
  "Spindle-speed limits",
  "Feed-rate limits",
  "Rapid-movement clearance",
  "Stock definition",
  "Work-offset consistency",
  "Missing operations",
  "Unmachined features",
  "Excessive remaining stock",
  "Incorrect part revision",
  "Missing critical-dimension operation",
  "Missing inspection checkpoint",
  "Unsupported post-processor",
  "Missing safe-start requirements",
] as const;

export const SIMULATION_CHECKS = [
  "Toolpath backplot",
  "Stock-removal simulation",
  "Machine simulation",
  "Tool collision detection",
  "Holder collision detection",
  "Fixture collision detection",
  "Machine-component collision detection",
  "Overtravel detection",
  "Rotary-limit review",
  "Remaining-stock analysis",
  "Gouge detection",
  "Tool-reach verification",
  "Rapid-movement review",
] as const;

export const APPROVAL_CHECKLIST = [
  "Customer part number",
  "Part revision",
  "CAD-model orientation",
  "Machine selection",
  "Controller",
  "Machine definition",
  "Post-processor",
  "Material",
  "Stock size",
  "Workholding",
  "Fixture clearance",
  "Setup sequence",
  "Work offsets",
  "Tool selection",
  "Tool numbers",
  "Holder selection",
  "Tool reach",
  "Tool stick-out",
  "Speeds and feeds",
  "Entry and exit moves",
  "Linking moves",
  "Clearance planes",
  "Rapid moves",
  "Cutting direction",
  "Stock-to-leave",
  "Tolerance settings",
  "Critical dimensions",
  "Surface-finish requirements",
  "Hole requirements",
  "Thread requirements",
  "Deburring requirements",
  "Inspection checkpoints",
  "Simulation results",
  "Machine travel",
  "Rotary travel",
  "Safe-start conditions",
  "Restart considerations",
  "Customer-specific requirements",
] as const;

export const CODE_REVIEW_CHECKS = [
  "Correct program number",
  "Correct units",
  "Correct work offsets",
  "Correct tool calls",
  "Correct spindle commands",
  "Correct coolant commands",
  "Safe-start lines",
  "Safe retracts",
  "Rotary commands",
  "Plane selection",
  "Compensation commands",
  "Canned-cycle format",
  "Subprogram calls",
  "End-of-program commands",
  "Controller-specific formatting",
  "No unexpected or unsupported codes",
] as const;

export const PROGRAMMER_PLAN_ACTIONS = [
  "Approve the plan",
  "Modify the setup sequence",
  "Change the machining orientation",
  "Select a different machine",
  "Change the workholding strategy",
  "Add or remove operations",
  "Modify the tooling strategy",
  "Request new tooling",
  "Flag fixture requirements",
  "Return for missing information",
  "Reject the plan and program manually",
] as const;

export const OPERATION_TYPES = [
  "Facing",
  "2D contouring",
  "Pocketing",
  "Dynamic milling",
  "Rest machining",
  "Drilling",
  "Spot drilling",
  "Tapping",
  "Thread milling",
  "Reaming",
  "Boring",
  "Chamfering",
  "3D roughing",
  "3D finishing",
  "Surface machining",
  "Multiaxis positioning",
  "Simultaneous 4-axis machining",
  "Simultaneous 5-axis machining",
  "Probing",
] as const;

export const EXCEPTION_KIND_META: Record<ExceptionKind, string> = {
  missing_customer_information: "Missing Customer Information",
  digital_data_recovery: "Digital Data Recovery Path",
  unsupported_machine_or_controller: "Unsupported Machine or Controller",
  tooling_gap: "Tooling Gap",
  fixture_gap: "Fixture Gap",
};

export const EXCEPTION_RESUME_STATUSES: JobStatus[] = [
  "iss_intake_review",
  "machine_profile_review",
  "tooling_review_required",
  "fixture_review_required",
  "ready_for_ai_planning",
];

export const EXCEPTION_BLOCKED_STATUSES: JobStatus[] = [
  "missing_information",
  "digital_data_recovery_required",
  "tooling_review_required",
  "fixture_review_required",
];
