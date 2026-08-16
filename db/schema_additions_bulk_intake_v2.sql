-- =====================================================================
-- Follow-up to schema_additions_bulk_intake.sql, applied separately since
-- intake_field_suggestions already exists in production (this ALTERs it
-- rather than re-running the original CREATE TABLE, which is a no-op on
-- an existing table via IF NOT EXISTS).
--
-- Found while starting Phase 3: the "never surface Ironclad's proprietary
-- methodology" rule needs the same DB-level guard on all three systems,
-- not just field_assessment. Each system turns out to have its own
-- consultant-authored "what we'd do about it" column:
--   - field_assessment: field_gaps.ironclad_action,
--     field_constraints.ironclad_response (already blocked)
--   - cap_assessment:    cap_actions.recommended_action (NOT yet blocked)
--   - template_assessment: findings.recommended_action (NOT yet blocked;
--     note this is a different table from assessment_responses, which is
--     what the template adapter actually targets)
--
-- root_cause / capability_needed / current_state-style analytical fields
-- are deliberately left open, consistent with field_gaps already allowing
-- those — only the direct "recommended action" columns are blocked.
-- =====================================================================

DO $$
DECLARE
  old_check_name text;
BEGIN
  -- Find the existing proprietary-methodology CHECK by its actual
  -- definition rather than assuming Postgres's auto-generated name for it.
  SELECT conname INTO old_check_name
  FROM pg_constraint
  WHERE conrelid = 'public.intake_field_suggestions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%ironclad_action%';

  IF old_check_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.intake_field_suggestions DROP CONSTRAINT %I', old_check_name);
  END IF;
END $$;

ALTER TABLE public.intake_field_suggestions
  ADD CONSTRAINT intake_field_suggestions_no_proprietary_methodology CHECK (
    NOT (
      target_system = 'field_assessment'
      AND target_field_path IN ('field_gaps.ironclad_action', 'field_constraints.ironclad_response')
    )
    AND NOT (
      target_system = 'cap_assessment'
      AND target_field_path = 'cap_actions.recommended_action'
    )
    AND NOT (
      target_system = 'template_assessment'
      AND target_field_path = 'findings.recommended_action'
    )
  );
