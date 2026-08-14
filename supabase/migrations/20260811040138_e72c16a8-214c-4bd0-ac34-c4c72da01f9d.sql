
ALTER TABLE public.field_assessments
  ADD COLUMN IF NOT EXISTS facility_name text,
  ADD COLUMN IF NOT EXISTS facility_location text,
  ADD COLUMN IF NOT EXISTS assessment_date date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS client_contact text,
  ADD COLUMN IF NOT EXISTS client_contact_title text,
  ADD COLUMN IF NOT EXISTS assessment_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS problem_department text,
  ADD COLUMN IF NOT EXISTS problem_machine text,
  ADD COLUMN IF NOT EXISTS problem_cell text,
  ADD COLUMN IF NOT EXISTS impact_notes text,
  ADD COLUMN IF NOT EXISTS executive_summary text,
  ADD COLUMN IF NOT EXISTS preliminary_conclusion text;

CREATE TABLE IF NOT EXISTS public.field_capture_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_assessment_id uuid NOT NULL REFERENCES public.field_assessments(id) ON DELETE CASCADE,
  domain_code text NOT NULL,
  category text,
  area text,
  machine text,
  production_cell text,
  process text,
  observed_condition text,
  objective_evidence text,
  assessor_notes text,
  context_source text,
  rating integer,
  not_observed boolean NOT NULL DEFAULT false,
  evidence_class text NOT NULL DEFAULT 'Observed',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_capture_observations TO authenticated;
GRANT ALL ON public.field_capture_observations TO service_role;
ALTER TABLE public.field_capture_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "field_capture_observations org access" ON public.field_capture_observations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(auth.uid(), a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(auth.uid(), a.organization_id)));
CREATE TRIGGER t_field_capture_obs_upd BEFORE UPDATE ON public.field_capture_observations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_fco_assessment ON public.field_capture_observations(field_assessment_id);

CREATE TABLE IF NOT EXISTS public.field_quick_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_assessment_id uuid NOT NULL REFERENCES public.field_assessments(id) ON DELETE CASCADE,
  note text,
  area text,
  machine text,
  domain_code text,
  potential_problem text,
  converted_observation_id uuid REFERENCES public.field_capture_observations(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_quick_captures TO authenticated;
GRANT ALL ON public.field_quick_captures TO service_role;
ALTER TABLE public.field_quick_captures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "field_quick_captures org access" ON public.field_quick_captures
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(auth.uid(), a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(auth.uid(), a.organization_id)));
CREATE TRIGGER t_field_quick_captures_upd BEFORE UPDATE ON public.field_quick_captures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.field_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_assessment_id uuid NOT NULL REFERENCES public.field_assessments(id) ON DELETE CASCADE,
  observation_id uuid REFERENCES public.field_capture_observations(id) ON DELETE CASCADE,
  gap_id uuid REFERENCES public.field_gaps(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text,
  caption text,
  area text,
  machine text,
  domain_code text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_attachments TO authenticated;
GRANT ALL ON public.field_attachments TO service_role;
ALTER TABLE public.field_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "field_attachments org access" ON public.field_attachments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(auth.uid(), a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(auth.uid(), a.organization_id)));

ALTER TABLE public.field_gaps
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS domain_code text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS observation_id uuid REFERENCES public.field_capture_observations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evidence_class text,
  ADD COLUMN IF NOT EXISTS confidence text,
  ADD COLUMN IF NOT EXISTS ironclad_actions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS operational_impact text,
  ADD COLUMN IF NOT EXISTS implementation_effort text,
  ADD COLUMN IF NOT EXISTS urgency text,
  ADD COLUMN IF NOT EXISTS ironclad_fit text,
  ADD COLUMN IF NOT EXISTS priority_code text,
  ADD COLUMN IF NOT EXISTS priority_class text,
  ADD COLUMN IF NOT EXISTS is_top_finding boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS field_rating integer;
