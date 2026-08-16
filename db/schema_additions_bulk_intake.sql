-- =====================================================================
-- Bulk Intake feature: shared document intake + per-system AI field
-- suggestions. Additive only — no existing table is modified.
--
-- Written to match this schema's actual conventions:
--   - plain Postgres (not Supabase): public.current_user_id(),
--     private.has_org_access(), app_user/app_admin roles, RLS policies.
--   - Uses private.has_org_access(...), matching where the function
--     actually lives by the time the field_* tables' policies are
--     created: it's defined as public.has_org_access early in the file,
--     then moved with `ALTER FUNCTION public.has_org_access(uuid, uuid)
--     SET SCHEMA private;` partway through. Confirmed by applying the
--     full schema.sql against a scratch database — no error, and
--     `SELECT n.nspname FROM pg_proc p JOIN pg_namespace n ...` shows the
--     function resolves to `private` after a full apply.
--   - gen_random_uuid(), public.update_updated_at_column() trigger,
--     GRANT ... TO app_user / app_admin, ENABLE ROW LEVEL SECURITY —
--     all reused exactly as elsewhere in this file.
--
-- Apply the same way as the rest of the schema, e.g.:
--   psql "$DATABASE_URL" -f db/schema_additions_bulk_intake.sql
-- or append this block to the end of db/schema.sql before a fresh apply.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.intake_document_category AS ENUM (
    'evaluator_note',
    'company_documentation',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.intake_document_status AS ENUM (
    'uploaded',
    'parsing',
    'parsed',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.intake_extraction_method AS ENUM (
    'pdf',
    'docx',
    'xlsx',
    'image_ocr',
    'text'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Deliberately narrower than cap_confidence ('low','moderate','high','verified')
  -- — nothing derived from an uploaded document dump should ever default to
  -- 'verified'. Adapters translate this into each target system's own
  -- confidence vocabulary at acceptance time; this enum is intake-internal.
  CREATE TYPE public.intake_confidence AS ENUM (
    'low',
    'moderate',
    'high'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.intake_target_system AS ENUM (
    'template_assessment',
    'cap_assessment',
    'field_assessment'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.intake_suggestion_status AS ENUM (
    'suggested',
    'accepted',
    'edited',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- intake_documents
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.intake_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  uploaded_by UUID,
  original_filename TEXT NOT NULL,
  mime_type TEXT,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  storage_path TEXT NOT NULL,
  category public.intake_document_category NOT NULL DEFAULT 'other',
  status public.intake_document_status NOT NULL DEFAULT 'uploaded',
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intake_documents_facility ON public.intake_documents(facility_id);
CREATE INDEX IF NOT EXISTS idx_intake_documents_org ON public.intake_documents(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_documents TO app_user;
GRANT ALL ON public.intake_documents TO app_admin;
ALTER TABLE public.intake_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "intake_documents org access" ON public.intake_documents;
CREATE POLICY "intake_documents org access" ON public.intake_documents FOR ALL TO app_user
  USING (private.has_org_access(public.current_user_id(), organization_id))
  WITH CHECK (private.has_org_access(public.current_user_id(), organization_id));

DROP TRIGGER IF EXISTS t_intake_documents_upd ON public.intake_documents;
CREATE TRIGGER t_intake_documents_upd BEFORE UPDATE ON public.intake_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- intake_extractions — raw extracted text per document. Kept separately
-- from AI conclusions so synthesis can be re-run against a smarter model
-- later without re-uploading, and so extraction failures are debuggable.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.intake_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.intake_documents(id) ON DELETE CASCADE,
  extraction_method public.intake_extraction_method NOT NULL,
  extracted_text TEXT NOT NULL DEFAULT '',
  token_count_estimate INTEGER CHECK (token_count_estimate IS NULL OR token_count_estimate >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intake_extractions_document ON public.intake_extractions(document_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_extractions TO app_user;
GRANT ALL ON public.intake_extractions TO app_admin;
ALTER TABLE public.intake_extractions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "intake_extractions org access" ON public.intake_extractions;
CREATE POLICY "intake_extractions org access" ON public.intake_extractions FOR ALL TO app_user
  USING (
    EXISTS (
      SELECT 1 FROM public.intake_documents d
      WHERE d.id = document_id AND private.has_org_access(public.current_user_id(), d.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.intake_documents d
      WHERE d.id = document_id AND private.has_org_access(public.current_user_id(), d.organization_id)
    )
  );

-- ---------------------------------------------------------------------
-- intake_field_suggestions — polymorphic across the three assessment
-- systems via three nullable typed FKs (no polymorphic-reference
-- precedent exists elsewhere in this schema — cap_finding_links is a
-- same-table self-reference, not cross-table — so this follows the
-- schema's existing habit of concrete typed FKs rather than inventing a
-- generic pattern).
--
-- organization_id/facility_id are denormalized here (not just derivable
-- via the target FK) so RLS stays a single simple check even before a
-- suggestion is attached to a concrete assessment row.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.intake_field_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,

  target_system public.intake_target_system NOT NULL,
  template_assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE,
  cap_assessment_id UUID REFERENCES public.cap_assessments(id) ON DELETE CASCADE,
  field_assessment_id UUID REFERENCES public.field_assessments(id) ON DELETE CASCADE,

  -- e.g. 'assessment_responses.comments', 'cap_problems.stated_problem',
  -- 'field_gaps.observed_condition'. App-validated against target_system;
  -- see the CHECK below for the one DB-level guardrail worth enforcing
  -- here (see the "no proprietary methodology" note).
  target_field_path TEXT NOT NULL,

  suggested_value TEXT NOT NULL,
  confidence public.intake_confidence NOT NULL DEFAULT 'moderate',
  source_document_ids UUID[] NOT NULL DEFAULT '{}',
  status public.intake_suggestion_status NOT NULL DEFAULT 'suggested',

  created_by UUID,
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Exactly one target FK may be set, and only the one matching target_system.
  CHECK (
    (template_assessment_id IS NULL OR target_system = 'template_assessment')
    AND (cap_assessment_id IS NULL OR target_system = 'cap_assessment')
    AND (field_assessment_id IS NULL OR target_system = 'field_assessment')
    AND num_nonnulls(template_assessment_id, cap_assessment_id, field_assessment_id) <= 1
  ),

  -- Defense in depth for the "never surface Ironclad's proprietary
  -- methodology" rule: field_gaps.ironclad_action and
  -- field_constraints.ironclad_response are consultant-authored only
  -- (see draftIroncladBridge in field-ai.functions.ts) and must never be
  -- written to from document-derived suggestions, at the schema level,
  -- not just by convention in application code.
  CHECK (
    NOT (
      target_system = 'field_assessment'
      AND target_field_path IN ('field_gaps.ironclad_action', 'field_constraints.ironclad_response')
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_intake_suggestions_facility ON public.intake_field_suggestions(facility_id);
CREATE INDEX IF NOT EXISTS idx_intake_suggestions_template_assessment ON public.intake_field_suggestions(template_assessment_id) WHERE template_assessment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intake_suggestions_cap_assessment ON public.intake_field_suggestions(cap_assessment_id) WHERE cap_assessment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intake_suggestions_field_assessment ON public.intake_field_suggestions(field_assessment_id) WHERE field_assessment_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_field_suggestions TO app_user;
GRANT ALL ON public.intake_field_suggestions TO app_admin;
ALTER TABLE public.intake_field_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "intake_field_suggestions org access" ON public.intake_field_suggestions;
CREATE POLICY "intake_field_suggestions org access" ON public.intake_field_suggestions FOR ALL TO app_user
  USING (private.has_org_access(public.current_user_id(), organization_id))
  WITH CHECK (private.has_org_access(public.current_user_id(), organization_id));

DROP TRIGGER IF EXISTS t_intake_field_suggestions_upd ON public.intake_field_suggestions;
CREATE TRIGGER t_intake_field_suggestions_upd BEFORE UPDATE ON public.intake_field_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
