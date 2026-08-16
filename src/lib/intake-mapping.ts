/**
 * Shared, pure logic for Bulk Intake's AI mapping adapters — no network
 * calls, no DB access, so this is unit-testable in isolation (see
 * intake-mapping.test.ts) unlike the actual AI calls in intake-ai.functions.ts,
 * capability-ai.functions.ts, field-ai.functions.ts, and
 * assessment-ai.functions.ts.
 */

export type IntakeTargetSystem =
  "template_assessment" | "cap_assessment" | "field_assessment";

/**
 * Fields each system's mapping adapter is allowed to write a suggestion for.
 * This is an app-layer mirror of the database's
 * intake_field_suggestions_no_proprietary_methodology CHECK constraint
 * (db/schema_additions_bulk_intake_v2.sql) — expressed as an allowlist here
 * rather than the DB's denylist, so a typo in a new field path fails closed
 * (rejected) instead of failing open (silently allowed through). The DB
 * constraint remains the actual enforcement boundary; this is defense in
 * depth so a bad adapter response is caught before it ever reaches a query,
 * not just before it's committed.
 *
 * Deliberately excluded, matching the DB constraint:
 * - field_gaps.ironclad_action, field_constraints.ironclad_response
 * - cap_actions.recommended_action
 * - findings.recommended_action
 * These are consultant-authored only (draftIroncladBridge, and the
 * assessor's own analysis elsewhere) — never document-derived.
 */
export const ALLOWED_FIELD_PATHS: Record<
  IntakeTargetSystem,
  readonly string[]
> = {
  template_assessment: [
    "assessment_responses.comments",
    "assessment_responses.evidence_description",
  ],
  cap_assessment: [
    "cap_problems.stated_problem",
    "cap_problems.location_process",
    "cap_problems.performance_impact",
    "cap_problems.previous_actions",
    "cap_problems.desired_outcome",
    "cap_performance_impacts.current_condition",
    "cap_performance_impacts.desired_condition",
    "cap_performance_impacts.metric_name",
    "cap_performance_impacts.data_source",
    "cap_performance_impacts.evidence",
  ],
  field_assessment: [
    "field_gaps.location",
    "field_gaps.observed_condition",
    "field_gaps.objective_evidence",
    "field_gaps.missing_capability",
    "field_gaps.current_state",
    "field_gaps.severity",
    "field_gaps.frequency",
    "field_constraints.capability_gap",
    "field_constraints.evidence",
    "field_constraints.production_impact",
    "field_observations.notes",
  ],
};

export function isAllowedFieldPath(
  system: IntakeTargetSystem,
  path: string,
): boolean {
  return ALLOWED_FIELD_PATHS[system].includes(path);
}

// ---------------------------------------------------------------------
// Gap list — pure diff, not a model call. Compares the fields a given
// system actually needs against the fields that already have an
// accepted/suggested value, producing what still needs assessor input.
// ---------------------------------------------------------------------

export interface GapListInput {
  system: IntakeTargetSystem;
  /** Every field path this specific assessment record cares about. */
  requiredFieldPaths: readonly string[];
  /** Field paths that already have a suggestion with status suggested/accepted/edited. */
  coveredFieldPaths: readonly string[];
}

export function computeGapList(input: GapListInput): string[] {
  const covered = new Set(input.coveredFieldPaths);
  return input.requiredFieldPaths.filter((path) => !covered.has(path));
}
