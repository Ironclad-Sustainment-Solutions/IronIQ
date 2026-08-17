-- =====================================================================
-- CAD Conversion product — Phase E, raster path first (per explicit
-- decision: the scanned-drawing / vision-AI path is the real value,
-- built before the vector DXF/DWG parsing path).
--
-- Deliberately mirrors the proven Bulk Intake shape (intake_documents /
-- intake_field_suggestions) rather than inventing a new pattern:
--   cad_jobs            ~ intake_documents  (the uploaded file + status)
--   cad_extracted_fields ~ intake_field_suggestions (AI draft, human
--                          reviews before it's treated as real data)
--
-- Same "product" concept as the Intelligence Layer (Phase B) —
-- intelligence_product already includes 'cad' as a valid value, so no
-- enum change needed there when this product starts feeding
-- intelligence_events later.
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE public.cad_source_type AS ENUM ('raster', 'vector');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cad_job_status AS ENUM ('uploaded', 'processing', 'extracted', 'reviewed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Kept open-ended (not a fixed small enum) since drawings vary widely
  -- in what they call things — validated/constrained in application code
  -- against a known set instead, same approach as intake_field_suggestions'
  -- target_field_path.
  CREATE TYPE public.cad_field_type AS ENUM (
    'title_block', 'dimension', 'tolerance', 'gdt', 'note', 'material', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cad_field_status AS ENUM ('suggested', 'accepted', 'edited', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.cad_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL,
  uploaded_by UUID,

  original_filename TEXT NOT NULL,
  mime_type TEXT,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  storage_path TEXT NOT NULL,

  -- Raster (scanned/photographed drawing) built first; vector (DXF/DWG)
  -- is a separate later pipeline sharing this same job table.
  source_type public.cad_source_type NOT NULL DEFAULT 'raster',
  status public.cad_job_status NOT NULL DEFAULT 'uploaded',
  failure_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cad_jobs_org ON public.cad_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_cad_jobs_facility ON public.cad_jobs(facility_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cad_jobs TO app_user;
GRANT ALL ON public.cad_jobs TO app_admin;
ALTER TABLE public.cad_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cad_jobs org access" ON public.cad_jobs;
CREATE POLICY "cad_jobs org access" ON public.cad_jobs FOR ALL TO app_user
  USING (private.has_org_access(public.current_user_id(), organization_id))
  WITH CHECK (private.has_org_access(public.current_user_id(), organization_id));

DROP TRIGGER IF EXISTS t_cad_jobs_upd ON public.cad_jobs;
CREATE TRIGGER t_cad_jobs_upd BEFORE UPDATE ON public.cad_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- cad_extracted_fields — one row per extracted data point (a dimension,
-- a tolerance, a title-block field, a GD&T callout, a note). Deliberately
-- one row per field rather than one big JSON blob per job — a drawing
-- can have dozens of dimensions, each independently reviewable/editable/
-- rejectable, same reasoning intake_field_suggestions already
-- established for Bulk Intake.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cad_extracted_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.cad_jobs(id) ON DELETE CASCADE,

  field_type public.cad_field_type NOT NULL,
  field_name TEXT NOT NULL, -- e.g. "Part Number", "Hole diameter (top-left)"
  field_value TEXT NOT NULL,
  -- Free-text description of where on the drawing this came from — not
  -- precise pixel coordinates. Vision models don't reliably return exact
  -- bounding boxes; asking for a text location description ("upper-right
  -- title block", "diameter callout near center-left hole") is honest
  -- about what's actually achievable rather than promising a precision
  -- overlay position the extraction can't actually back up.
  location_hint TEXT,

  confidence public.intake_confidence NOT NULL DEFAULT 'moderate', -- reuses Bulk Intake's enum, same semantics
  status public.cad_field_status NOT NULL DEFAULT 'suggested',
  reviewed_by UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cad_fields_job ON public.cad_extracted_fields(job_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cad_extracted_fields TO app_user;
GRANT ALL ON public.cad_extracted_fields TO app_admin;
ALTER TABLE public.cad_extracted_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cad_extracted_fields org access" ON public.cad_extracted_fields;
CREATE POLICY "cad_extracted_fields org access" ON public.cad_extracted_fields FOR ALL TO app_user
  USING (
    EXISTS (
      SELECT 1 FROM public.cad_jobs j
      WHERE j.id = job_id AND private.has_org_access(public.current_user_id(), j.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cad_jobs j
      WHERE j.id = job_id AND private.has_org_access(public.current_user_id(), j.organization_id)
    )
  );
